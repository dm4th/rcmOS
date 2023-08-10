// deno-lint-ignore-file no-async-promise-executor
import axios from 'axios';

export const uploadFileAWS = async (file, stage, setUploadStage) => {
    if (!file) {
        // If no file is passed to the function, return hard-coded textract job id
        const jobIds = "d8d52da16679f70b4c2c8950bb8acfd288b4019d1b2f07067ef54ed4e7adccd8";
        setUploadStage((prevState) => {
            const newState = [...prevState];
            newState[stage].progress = 100;
            return newState;
        });
        return jobIds;
    }

    // If file type is not a pdf, return nothing
    if (file.type !== 'application/pdf') {
        alert('Please upload a PDF file.');
        return;
    }
    
    // Request Pre-Signed URL from API Gateway
    const urlRes = await axios.post(process.env.NEXT_PUBLIC_AWS_UPLOAD_FUNCTION_URL + 'record', {
        fileName: file.name,
    });
    const url = JSON.parse(urlRes.data.body).url;

    // Upload file to S3 with Pre-Signed URL
    const uploadRes = await axios.put(url, file, {
        headers: {
            'Content-Type': 'application/pdf',
        },
        onUploadProgress: (progressEvent) => {
            const { loaded, total } = progressEvent;
            const percent = Math.floor((loaded / total) * 100);
            setUploadStage((prevState) => {
                const newState = [...prevState];
                newState[stage].progress = percent;
                return newState;
            });
        },
    });

    if (uploadRes.status !== 200) {
        alert('Error uploading file to S3');
        return;
    }

    // Kick off Textract Processing
    const textractRes = await axios.post(process.env.NEXT_PUBLIC_AWS_PROCESS_FUNCTION_URL, {
        S3Object: {
            Bucket: process.env.NEXT_PUBLIC_S3_BUCKET + 'records',
            Name: file.name,
        },
    });
    const jobId = JSON.parse(textractRes.data.body).JobId;

    return jobId;
};

export const textractOCR = async (jobId, pollStageId, retrieveStageId, setUploadStage) => {
    // Poll Textract Job Status
    console.log(jobId);
    setUploadStage((prevState) => {
        const newState = [...prevState];
        newState[pollStageId].active = true;
        return newState;
    });
    const pages = await pollJobAWS(jobId, pollStageId, setUploadStage);
    if (!pages) return;

    // Retrieve Full Textract Results
    setUploadStage((prevState) => {
        const newState = [...prevState];
        newState[retrieveStageId].active = true;
        return newState;
    });
    const results = await getResultsAWS(jobId, retrieveStageId, setUploadStage);
    if (!results) return;
    return results;
};

const pollJobAWS = async (jobId, stage, setUploadStage) => {
    // Poll Textract Job Status
    let jobStatus = 'IN_PROGRESS';
    let statusRes;
    let uploadTracker = 0;
    while (jobStatus === 'IN_PROGRESS') {
        // poll every 0.5 seconds
        await new Promise((resolve) => {
            setTimeout(resolve, 2000);
        });

        statusRes = await axios.post(process.env.NEXT_PUBLIC_AWS_PROCESS_FUNCTION_URL, {
            JobId: jobId,
        });
        jobStatus = JSON.parse(statusRes.data.body).JobStatus;
        uploadTracker++;
        if (uploadTracker >= 95) {
            setUploadStage((prevState) => {
                const newState = [...prevState];
                newState[stage].stage = 'Processing Document with AWS Textract - Taking Longer than Expected';
                newState[stage].progress = 95;
                return newState;
            });
        }
        else setUploadStage((prevState) => {
            const newState = [...prevState];
            newState[stage].stage = 'Processing Document with AWS Textract';
            newState[stage].progress = uploadTracker;
            return newState;
        });
    }

    // If job status is not SUCCEEDED, return null
    if (jobStatus !== 'SUCCEEDED') {
        console.error(JSON.parse(statusRes.data.body));
        alert('Error processing file with AWS Textract');
        return null;
    }

    setUploadStage((prevState) => {
        const newState = [...prevState];
        newState[stage].stage = 'Processing Document with AWS Textract';
        newState[stage].progress = 100;
        return newState;
    });
    return JSON.parse(statusRes.data.body).Metadata.Pages;
};

const getResultsAWS = async (jobId, stage, setUploadStage) => {
    // Retrieve Full Textract Results
    let nextToken = null;
    let first = true;
    let totalPages = 0;

    const lineBlockTypes = ['LINE', 'PAGE'];
    let oldLineBlocks = [];
    let returnLineBlocks = [];

    const tableBlockTypes = ['TABLE', 'TABLE_TITLE', 'TABLE_FOOTER', 'CELL', 'MERGED_CELL', 'WORD'];
    let oldTableBlocks = [];
    let oldTextBlocks = [];
    let returnTableBlocks = [];

    const kvBlockTypes = ['KEY_VALUE_SET', 'WORD', 'LINE', 'SELECTION_ELEMENT', 'PAGE'];
    let oldKvBlocks = [];
    let oldSelectionBlocks = [];
    let returnKvBlocks = [];

    while (first || nextToken) {
        let jobRes;
        if (first) {
            first = false;
            jobRes = await axios.post(process.env.NEXT_PUBLIC_AWS_PROCESS_FUNCTION_URL, {
                JobId: jobId,
            });
            totalPages = JSON.parse(jobRes.data.body).Metadata.Pages * 3.0; // Need to do each page three times
        } else {
            jobRes = await axios.post(process.env.NEXT_PUBLIC_AWS_PROCESS_FUNCTION_URL, {
                JobId: jobId,
                NextToken: nextToken,
            });
        }
        const jobData = JSON.parse(jobRes.data.body);

        // Parse Returned Page & Line Blocks for finished pages 
        const lineBlocks = jobData.Blocks.filter((block) => lineBlockTypes.includes(block.BlockType));
        const { completedLinePages, leftoverLineBlocks } = handlePageAWS(oldLineBlocks, lineBlocks);
        oldLineBlocks = leftoverLineBlocks;
        returnLineBlocks = returnLineBlocks.concat(completedLinePages);

        // Parse Returned Table Blocks for finished pages
        const newTableBlocks = jobData.Blocks.filter((block) => tableBlockTypes.includes(block.BlockType));
        const { completedTables, tableBlocks, combinedBlocks } = handleTableAWS(oldTableBlocks, oldTextBlocks, newTableBlocks);
        oldTableBlocks = tableBlocks;
        oldTextBlocks = combinedBlocks;
        returnTableBlocks = returnTableBlocks.concat(completedTables);

        // Parse Returned Key-Value Blocks for finished pages
        const newKvBlocks = jobData.Blocks.filter((block) => kvBlockTypes.includes(block.BlockType));
        const { completedKvBlocks, kvBlocks, selectionBlocks } = handleKvAWS(oldKvBlocks, oldSelectionBlocks, newKvBlocks);
        oldKvBlocks = kvBlocks;
        oldSelectionBlocks = selectionBlocks;
        returnKvBlocks = returnKvBlocks.concat(completedKvBlocks);

        // Update Progress and track Next Token
        // For Lines, the progress is the length of the returnLineBlocks array
        // For Tables, the progress is the maximum page attribute in the returnTableBlocks array
        // For KVs, the progress is the maximum page attribute in the returnKvBlocks array
        nextToken = jobData.NextToken;
        const maxLinePage = returnLineBlocks.length;
        const maxTablePage = returnTableBlocks.length > 0 ? Math.max(...returnTableBlocks.map((block) => block.page)) : 0;
        const maxKvPage = returnKvBlocks.length > 0 ? Math.max(...returnKvBlocks.map((block) => block.page)) : 0;
        const processedPages = maxLinePage + maxTablePage + maxKvPage;
        setUploadStage((prevState) => {
            const newState = [...prevState];
            newState[stage].progress = Math.floor((processedPages / totalPages) * 100);
            return newState;
        });
    }

    // Handle any leftover blocks
    returnLineBlocks = returnLineBlocks.concat([oldLineBlocks]);
    returnTableBlocks = returnTableBlocks.concat(oldTableBlocks);
    returnKvBlocks = returnKvBlocks.concat(oldKvBlocks);
    
    const textBlocks = returnLineBlocks;
    
    const tableBlocks = [];
    for (let i = 0; i < returnTableBlocks.length; i++) {
        const tablePage = returnTableBlocks[i].page;
        while (tableBlocks.length < tablePage) {
            tableBlocks.push([]);
        }
        tableBlocks[tablePage - 1].push(returnTableBlocks[i]);
    }

    const kvBlocks = [];
    for (let i = 0; i < returnKvBlocks.length; i++) {
        const kvPage = returnKvBlocks[i].page;
        while (kvBlocks.length < kvPage) {
            kvBlocks.push([]);
        }
        kvBlocks[kvPage - 1].push(returnKvBlocks[i]);
    }


    setUploadStage((prevState) => {
        const newState = [...prevState];
        newState[stage].progress = 100;
        return newState;
    });
    // return an array of arrays for each page of line blocks, an array of arrays for each page of table blocks, and an array of arrays for each page of kv blocks
    return {
        textBlocks,
        tableBlocks,
        kvBlocks,
    };
};

const handlePageAWS = (oldBlocks, newBlocks) => {
    // Create return array
    const completedLinePages = [];

    // Loop through newBlocks
    // If we find a new page, extend the old blocks array by all of the previous newBlocks items before the new page
    // Then add that extended array to the completedPages array
    // Then set the current page to the new page we found, set oldBlocks to null, and continue
    // If we don't find a new page, add the new block to the oldBlocks array and return it as part of the funciton return object
    for (let i = 0; i < newBlocks.length; i++) {
        const block = newBlocks[i];
        if (block.BlockType === 'PAGE') {
            if (oldBlocks.length > 0) {
                completedLinePages.push(oldBlocks);
                oldBlocks = [];
            }
            oldBlocks.push(block);
        } else {
            oldBlocks.push(block);
        }
    }
    const leftoverLineBlocks = oldBlocks;
    return { completedLinePages, leftoverLineBlocks };
};

const handleTableAWS = (oldTables, oldBlocks, newBlocks) => {
    // // Create return array
    const completedTables = [];

    // Split newBlocks into new Tables and everything else
    // add new table objects to the oldTables array to create the table array
    // just concat the rest of the new block to the old blocks to get the combined array
    const newTableBlocks = newBlocks.filter((block) => block.BlockType === 'TABLE');
    const tableBlocks = oldTables.concat(newTableBlocks.map((block) => createTable(block)));
    let combinedBlocks = oldBlocks.concat(newBlocks.filter((block) => block.BlockType !== 'TABLE'));

    // then loop through the table blocks and process them
    for (let i = 0; i < tableBlocks.length; i++) {
        const { table: newTable, processBlocks } = processTable(tableBlocks[i], combinedBlocks);
        combinedBlocks = processBlocks;
        if (newTable.isComplete) {
            tableBlocks.splice(i, 1);
            completedTables.push(newTable);
        }
    }

    return { completedTables, tableBlocks, combinedBlocks };
};

const handleKvAWS = (oldKvBlocks, oldSelectionBlocks, newBlocks) => {
    // Create return array
    const completedKvBlocks = [];

    // Split newBlocks into new Key blocks and everything else
    // add new key blocks to the oldKvBlocks array to create the kv array
    // just concat the rest of the new block to the old blocks to get the combined array
    const newKvBlocks = newBlocks.filter((block) => block.BlockType === 'KEY_VALUE_SET' && block.EntityTypes.includes('KEY'));
    const kvBlocks = oldKvBlocks.concat(newKvBlocks.map((block) => createKv(block)));
    let selectionBlocks = oldSelectionBlocks.concat(newBlocks.filter((block) => block.BlockType !== 'KEY_VALUE_SET' || !block.EntityTypes.includes('KEY')));

    // then loop through the kv blocks and process them
    for (let i = 0; i < kvBlocks.length; i++) {
        const { kv: newKv, processBlocks } = processKv(kvBlocks[i], selectionBlocks);
        selectionBlocks = processBlocks;
        if (newKv.isComplete) {
            kvBlocks.splice(i, 1);
            completedKvBlocks.push(newKv);
        }
    }

    return { completedKvBlocks, kvBlocks, selectionBlocks };
};

const createTable = (tableBlock) => {
    return {
        page: tableBlock.Page,
        title: null,
        footer: null,
        confidence: tableBlock.Confidence,
        cells: [],
        left: tableBlock.Geometry.BoundingBox.Left,
        top: tableBlock.Geometry.BoundingBox.Top,
        right: tableBlock.Geometry.BoundingBox.Left + tableBlock.Geometry.BoundingBox.Width,
        bottom: tableBlock.Geometry.BoundingBox.Top + tableBlock.Geometry.BoundingBox.Height,
        isComplete: false,
        children: tableBlock.Relationships.flatMap(r => r.Ids),
        processedChildren: [],
    };
};

const processTable = (table, blocks) => {
    // loop through table remianing children and search for them in the blocks array
    // if we find them, add them to the table object and remove them from the blocks array
    // return the new table and blocks objects to overwrite the old ones
    let processBlocks = blocks;
    const remainingChildren = table.children.filter((childId) => !table.processedChildren.includes(childId));
    for (let c = 0; c < remainingChildren.length; c++) {
        const childId = remainingChildren[c];
        const index = processBlocks.findIndex((block) => block.Id === childId);
        if (index !== -1) {
            const block = processBlocks[index];
            const { returnText, returnBlocks } = retrieveTextAWS(block, processBlocks);
            processBlocks = returnBlocks;
            if (block.BlockType === 'TABLE_TITLE') {
                table.title = returnText;
            } else if (block.BlockType === 'TABLE_FOOTER') {
                table.footer = returnText;
            } else if (block.BlockType === 'CELL' || block.BlockType === 'MERGED_CELL') {
                if (returnText.length > 0) {
                    table.cells.push({
                        columnIndex: block.ColumnIndex,
                        columnSpan: block.ColumnSpan,
                        rowIndex: block.RowIndex,
                        rowSpan: block.RowSpan,
                        confidence: block.Confidence,
                        text: returnText ? returnText : "",
                    });
                }
            }
            table.processedChildren.push(childId);
        }
    }
    table.isComplete = table.children.length === table.processedChildren.length;
    return { table, processBlocks };
};

const createKv = (kvBlock) => {
    const valueChildren = kvBlock.Relationships.find((r) => r.Type === 'VALUE');
    const textChildren = kvBlock.Relationships.find((r) => r.Type === 'CHILD');
    return {
        page: kvBlock.Page,
        key: "",
        value: "",
        keyConfidence: kvBlock.Confidence,
        valueConfidence: 0,
        left: kvBlock.Geometry.BoundingBox.Left,
        top: kvBlock.Geometry.BoundingBox.Top,
        right: kvBlock.Geometry.BoundingBox.Left + kvBlock.Geometry.BoundingBox.Width,
        bottom: kvBlock.Geometry.BoundingBox.Top + kvBlock.Geometry.BoundingBox.Height,
        isComplete: false,
        valueChildren: valueChildren ? valueChildren.Ids : [],
        textChildren: textChildren ? textChildren.Ids : [],
        processedChildren: [],
    };
};

const processKv = (kv, blocks) => {
    // first loop over valueChildren and search for them in the blocks array
    // if we find them, add them to the value object and remove them from the blocks array
    // remember to update the kv object's directional attributes with new values if needed
    let processBlocks = blocks;
    const remainingValueChildren = kv.valueChildren.filter((childId) => !kv.processedChildren.includes(childId));
    for (let c = 0; c < remainingValueChildren.length; c++) {
        const childId = remainingValueChildren[c];
        const index = processBlocks.findIndex((block) => block.Id === childId);
        if (index !== -1) {
            const block = processBlocks[index];
            const { returnText, returnConfidence, returnLeft, returnTop, returnRight, returnBottom, returnBlocks } = retrieveValueAWS(block, kv.valueConfidence, kv.left, kv.top, kv.right, kv.bottom, processBlocks);
            processBlocks = returnBlocks;
            kv.value = returnText ? returnText : "";
            kv.valueConfidence = returnConfidence;
            if (returnLeft < kv.left) kv.left = returnLeft;
            if (returnTop < kv.top) kv.top = returnTop;
            if (returnRight > kv.right) kv.right = returnRight;
            if (returnBottom > kv.bottom) kv.bottom = returnBottom;
            kv.processedChildren.push(childId);
        }
    }

    // then loop over textChildren and search for them in the blocks array
    // if we find them, add them to the key object and remove them from the blocks array
    const remainingTextChildren = kv.textChildren.filter((childId) => !kv.processedChildren.includes(childId));
    for (let c = 0; c < remainingTextChildren.length; c++) {
        const childId = remainingTextChildren[c];
        const index = processBlocks.findIndex((block) => block.Id === childId);
        if (index !== -1) {
            const block = processBlocks[index];
            const { returnText, returnBlocks } = retrieveTextAWS(block, processBlocks);
            processBlocks = returnBlocks;
            kv.key = returnText ? returnText : "";
            kv.processedChildren.push(childId);
        }
    }

    kv.isComplete = kv.valueChildren.length + kv.textChildren.length === kv.processedChildren.length;
    return { kv, processBlocks };
};


const retrieveTextAWS = (block, blocks) => {
    // Recursively search child blocks for text and remove the branch from the blocks array when text is found
    let returnText = '';
    let returnBlocks = [...blocks];

    // If the block has text, add the text to the returnText string and remove the block from the blocks array
    if (block.Text) {
        returnText += block.Text + ' ';
        const index = returnBlocks.findIndex((b) => b.Id === block.Id);
        if (index !== -1) {
            returnBlocks.splice(index, 1);
        }
    }

    // If the block has children, search them for text
    // once all of the children have been searched, remove the block from the blocks array
    if (block.Relationships) {
        const childIds = block.Relationships.flatMap(r => r.Ids);
        childIds.forEach((child) => {
            const index = returnBlocks.findIndex((b) => b.Id === child);
            if (index !== -1) {
                const { returnText: childText, returnBlocks: childBlocks } = retrieveTextAWS(returnBlocks[index], returnBlocks);
                returnText += childText;
                returnBlocks = childBlocks;
            }
        });
    }

    return { returnText, returnBlocks };
};

const retrieveValueAWS = (block, confidence, left, top, right, bottom, blocks) => {
    // Recursively search child blocks for text and remove the branch from the blocks array when text is found
    // If the block is a VALUE block, update bounding box values
    let returnText = '';
    let returnConfidence = confidence;
    let returnLeft = left;
    let returnTop = top;
    let returnRight = right;
    let returnBottom = bottom;
    let returnBlocks = [...blocks];

    // If the block has text, add the text to the returnText string and remove the block from the blocks array
    if (block.Text) {
        returnText += block.Text + ' ';
        const index = returnBlocks.findIndex((b) => b.Id === block.Id);
        if (index !== -1) {
            returnBlocks.splice(index, 1);
        }
    }

    else if (block.SelectionStatus) {
        returnText += block.SelectionStatus === 'SELECTED' ? 'TRUE' : 'FALSE';
        const index = returnBlocks.findIndex((b) => b.Id === block.Id);
        if (index !== -1) {
            returnBlocks.splice(index, 1);
        }
    }

    else if (block.BlockType === 'KEY_VALUE_SET' && block.EntityTypes.includes('VALUE')) {
        returnConfidence = block.Confidence > returnConfidence ? block.Confidence : returnConfidence;
        returnLeft = block.Geometry.BoundingBox.Left < returnLeft ? block.Geometry.BoundingBox.Left : returnLeft;
        returnTop = block.Geometry.BoundingBox.Top < returnTop ? block.Geometry.BoundingBox.Top : returnTop;
        returnRight = block.Geometry.BoundingBox.Left + block.Geometry.BoundingBox.Width > returnRight ? block.Geometry.BoundingBox.Left + block.Geometry.BoundingBox.Width : returnRight;
        returnBottom = block.Geometry.BoundingBox.Top + block.Geometry.BoundingBox.Height > returnBottom ? block.Geometry.BoundingBox.Top + block.Geometry.BoundingBox.Height : returnBottom;
    }

    // If the block has children, search them for text
    // once all of the children have been searched, remove the block from the blocks array
    if (block.Relationships) {
        const childIds = block.Relationships.flatMap(r => r.Ids);
        childIds.forEach((child) => {
            const index = returnBlocks.findIndex((b) => b.Id === child);
            if (index !== -1) {
                const { returnText: childText, returnConfidence: childConfidence, returnLeft: childLeft, returnTop: childTop, returnRight: childRight, returnBottom: childBottom, returnBlocks: childBlocks } = retrieveValueAWS(returnBlocks[index], returnConfidence, returnLeft, returnTop, returnRight, returnBottom, returnBlocks);
                returnText += childText;
                returnConfidence = childConfidence;
                returnLeft = childLeft;
                returnTop = childTop;
                returnRight = childRight;
                returnBottom = childBottom;
                returnBlocks = childBlocks;
            }
        });
    }

    return { returnText, returnConfidence, returnLeft, returnTop, returnRight, returnBottom, returnBlocks };
};