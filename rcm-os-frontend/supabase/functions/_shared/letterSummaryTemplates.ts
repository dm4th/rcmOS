import GPT3Tokenizer from 'https://esm.sh/gpt3-tokenizer';
import { PromptTemplate } from "https://esm.sh/langchain/prompts";

const MAX_CITATION_TOKENS = 2500;
const MAX_CHAT_HISTORY_TOKENS = 500;

const MAX_PAGE_SUMMARY_TOKENS = 3000;
const PAGE_SUMMARY_CONFIDENCE_THRESHOLD = 0.8;
const TABLE_SUMMARY_CONFIDENCE_THRESHOLD = 0.8;
const KV_SUMMARY_CONFIDENCE_THRESHOLD = 0.8;

export const gpt3Tokenizer = new GPT3Tokenizer({ type: 'gpt3' });

export const letterReSummaryTemplate = ((claimDenialReasons: string[], prompt: string, summary: string) => {

    const claimDenialReasonsString = claimDenialReasons.join("\n");

    const promptString = `You are a Medical Documentation Specialist tasked with analyzing an insurance claim denial letter.\n` +
    `The primary goal of your analysis is to determine the reason why the insurance claim was denied.\n` +
    `The end user has asked you to re-summarize a letter that has already been summarized.\n` +
    `Here is the previous summary of the letter:\n` +
    `${summary}\n` +
    `The user provided the following instructions for how to re-summarize the letter:\n` +
    `${prompt}\n` +
    `Below is a list of possible medical reasons why the insurance claim was denied, in each case prefaced with the text 'REASON:'\n` +
    claimDenialReasonsString +
    `\n\nGiven the above information about the possible reasons for the insurance claim denial and changes the user would like you to make, re-write the summary for why the insurance claim was denied.\n` +
    `The text you generate will be used for future operations, so please be as succinct and direct as possible in your response. Additionally do not include the text "REASON: " in your response.` +
    `If the user asked you to generate a longer summary, please do not do so and stick to keeping the summary to a maximum of two sentences.`;

    return PromptTemplate.fromTemplate(promptString);
        
});

export const letterSummaryTemplate = ((claimDenialReasons: string[]) => {

    const claimDenialReasonsString = claimDenialReasons.join("\n");

    return PromptTemplate.fromTemplate(
        `You are a Medical Documentation Specialist tasked with analyzing an insurance claim denial letter.\n` +
        `The primary goal of your analysis is to determine the reason why the insurance claim was denied.\n` +
        `Below is a list of possible medical reasons why the insurance claim was denied, in each case prefaced with the text 'REASON:'\n` +
        claimDenialReasonsString +
        `\n\nGiven the above information about the possible reasons for the insurance claim denial, write a one-to-two sentance summary for why the insurance claim was denied.\n` +
        `The text you generate will be used for future operations, so please be as succinct and direct as possible in your response. Additionally do not include the text "REASON: " in your response`
    );
});

export const textSectionTemplate = ((outputFixingParser: Any) => {

    return new PromptTemplate({
        template: `You are a Medical Documentation Specialist tasked with analyzing an insurance claim denial letter.\n` +
        `Your objectives are:\n` +
        `1. Determine why the insurance claim was denied.\n` + 
        `2. Determine if the text from the letter matches any common data elements listed below.\n` +
        `These are separate goals, so please respond to each one separately. It is possible to find a reason for the denial without finding any common data elements and vice versa.` +
        `Below is a markdown formatted table of text pulled from section {sectionNumber} on page {pageNumber} of an insurance denial letter using machine learning / OCR. The table contains the following columns:\n` +
        "1. Text: The text retrieved from the document\n" +
        "2. Confidence: A percentage with 100% being very confident that the text pulled from the document is correct. Anything below 99.5 should be viewed very cautiously.\n" +
        "3. Left: A percentage representing how far left on the page the text appears. 0% is the very left of the page, 100% is all the way to the right.\n" +
        "4. Top: A percentage representing how far up on the page the text appears. 0% is the very top of the page, 100% is all the way on the bottom.\n" +
        "5. Width: A percentage representing how far across the page the text spans. 0% means the text has no width at all, 100% means the text spans across the entire page.\n" +
        "6. Height: A percentage representing how tall the text is on the page. 0% means the text has no height at all, 100% means the text spans the entire height of the page.\n" +
        "\nBelow is the data for the retrieved page:\n\n" +
        "{markdownTable}" +
        `\n\nBelow is a markdown formatted table containing common medical data elements that are pertinent to any appeal. The table contains the following columns:\n` +
        "1. Field: The name of the medical data element you are looking for.\n" +
        "2. Medical Terms: Common medical terms that are associated with describing this data element.\n" +
        "3. Description: description of the data element.\n" +
        "4. Additional LLM Instructions: Additional Instructions for you to observe when you summarize your findings regarding this element.\n" +
        "\nBelow is the data for the common medical data elements:\n\n" +
        "{dataElementsTable}" +
        `\n\nGiven the above information about the text retrieved from the denial letter and common data elements to search for, can you determine why the claim was denied and/or find any elements in this text?\n` +
        'Remember that adjacent and nearby text can be used to help determine the meaning of the text you are looking at. Please feel free to cite other records in the data markdown table above as you search for denial reasons and common data elements.\n' +
        'It is more important to return common data elements than exclude them, so please err on the side of returning data elements if you are unsure. Simply indicate your certainty in your confidence score for that match. Please use the full range of 0-1 when letting me know how confident you are in your match.\n\n' +
        "{formatInstructions}",
        inputVariables: ['pageNumber', 'sectionNumber', 'markdownTable', 'dataElementsTable'],
        partialVariables: {
            formatInstructions: outputFixingParser.getFormatInstructions()
        }
    });
});

export const tableSectionTemplate = ((outputFixingParser: Any) => {

    return new PromptTemplate({
        template: `You are a Medical Documentation Specialist tasked with analyzing an insurance claim denial letter.\n` +
        `Your objectives are:\n` +
        `1. Determine why the insurance claim was denied.\n` + 
        `2. Determine if the text from the letter matches any common data elements listed below.\n` +
        `These are separate goals, so please respond to each one separately. It is possible to find a reason for the denial without finding any common data elements and vice versa.` +
        `You are analyzing section {sectionNumber} of a table of information pulled from an insurance claim denial letter using machine learning / OCR.\n` +
        "Below is a description of the table in the denial letter that you are tasked with analyzing:\n" +
        "{tablePrompt}" +
        "Additionally, below is a markdown formatted table describing the cells of information in the table. The table contains the following columns:\n" +
        "1. Text: The text retrieved from the document\n" +
        "2. Confidence: A percentage with 100% being very confident that the text pulled from the document is correct. Anything below 99.5 should be viewed very cautiously.\n" +
        "3. Left: A percentage representing how far left on the page the text appears. 0% is the very left of the page, 100% is all the way to the right.\n" +
        "4. Top: A percentage representing how far up on the page the text appears. 0% is the very top of the page, 100% is all the way on the bottom.\n" +
        "5. Width: A percentage representing how far across the page the text spans. 0% means the text has no width at all, 100% means the text spans across the entire page.\n" +
        "6. Height: A percentage representing how tall the text is on the page. 0% means the text has no height at all, 100% means the text spans the entire height of the page.\n" +
        "\nBelow is the data for the retrieved page:\n\n" +
        "{markdownTable}" +
        `\n\nBelow is a markdown formatted table containing common medical data elements that are pertinent to any appeal. The table contains the following columns:\n` +
        "1. Field: The name of the medical data element you are looking for.\n" +
        "2. Medical Terms: Common medical terms that are associated with describing this data element.\n" +
        "3. Description: description of the data element.\n" +
        "4. Additional LLM Instructions: Additional Instructions for you to observe when you summarize your findings regarding this element.\n" +
        "\nBelow is the data for the common medical data elements:\n\n" +
        "{dataElementsTable}" +
        `\n\nGiven the above information about the tablualr information retrieved from the denial letter and common data elements to search for, can you determine why the claim was denied and/or find any elements in this table?\n` +
        'Remember that adjacent and nearby text can be used to help determine the meaning of the data you are looking at. Please feel free to cite other records in the data markdown table above as you search for denial reasons and common data elements.\n' +
        'It is more important to return common data elements than exclude them, so please err on the side of returning data elements if you are unsure. Simply indicate your certainty in your confidence score for that match. Please use the full range of 0-1 when letting me know how confident you are in your match.\n\n' + 
        "{formatInstructions}",
        inputVariables: ['sectionNumber', 'tablePrompt', 'markdownTable', 'dataElementsTable'],
        partialVariables: {
            formatInstructions: outputFixingParser.getFormatInstructions()
        }
    });
});

export const kvSectionTemplate = ((outputFixingParser: Any) => {

    return new PromptTemplate({
        template: `You are a Medical Documentation Specialist tasked with analyzing an insurance claim denial letter.\n` +
        `Your objectives are:\n` +
        `1. Determine why the insurance claim was denied.\n` + 
        `2. Determine if the text from the letter matches any common data elements listed below.\n` +
        `These are separate goals, so please respond to each one separately. It is possible to find a reason for the denial without finding any common data elements and vice versa.` +
        `Below is a markdown formatted table of key value pairs in a form pulled from {pageDesc} of an insurance claim denial letter using machine learning / OCR. The table contains the following columns:\n` +
        "1. Key: The key of the key value pair\n" +
        "2. Value: The value of the key value pair\n" +
        "3. Confidence: A percentage with 100% being very confident that the text pulled from the document is correct. Anything below 50% should be viewed very cautiously.\n" +
        "4. Left: A percentage representing how far left on the page the text appears. 0% is the very left of the page, 100% is all the way to the right.\n" +
        "5. Top: A percentage representing how far up on the page the text appears. 0% is the very top of the page, 100% is all the way on the bottom.\n" +
        "6. Right: A percentage representing how far right on the page the text appears. 0% is the very left of the page, 100% is all the way to the right.\n" +
        "7. Bottom: A percentage representing how far down on the page the text appears. 0% is the very top of the page, 100% is all the way on the bottom.\n" +
        "\nBelow is the the markdown table describing the key-value pair data on this part of the page:\n\n" +
        "{markdownTable}" +
        `\n\nBelow is a markdown formatted table containing common medical data elements that are pertinent to any appeal. The table contains the following columns:\n` +
        "1. Field: The name of the medical data element you are looking for.\n" +
        "2. Medical Terms: Common medical terms that are associated with describing this data element.\n" +
        "3. Description: description of the data element.\n" +
        "4. Additional LLM Instructions: Additional Instructions for you to observe when you summarize your findings regarding this element.\n" +
        "\nBelow is the data for the common medical data elements:\n\n" +
        "{dataElementsTable}" +
        `\n\nGiven the above information about the key-value pairs retrieved from the denial letter and common data elements to search for, can you determine why the claim was denied and/or find any elements in this text?\n` + 
        'Remember that adjacent and nearby text can be used to help determine the meaning of the text you are looking at. Please feel free to cite other records in the data markdown table above as you search for denial reasons and common data elements.\n' +
        'It is more important to return common data elements than exclude them, so please err on the side of returning data elements if you are unsure. Simply indicate your certainty in your confidence score for that match. Please use the full range of 0-1 when letting me know how confident you are in your match.\n\n' +
        "{formatInstructions}",
        inputVariables: ['pageDesc', 'markdownTable', 'dataElementsTable'],
        partialVariables: {
            formatInstructions: outputFixingParser.getFormatInstructions()
        }
    });
});


export const textMarkdownTableGenerator = ((columns: string[], data: (string | number)[][]) => {
    // columns is an array of strings
    // data is an array of arrays of strings/numbers

    // get the max length of each column
    const columnWidths = columns.map((column, index) => {
        let maxLength = column.length;
        data.forEach((row) => {
            if (row[index].toString().length > maxLength) {
                maxLength = row[index].toString().length;
            }
        });
        return maxLength;
    });

    // remove any rows that have confidence less than PAGE_SUMMARY_CONFIDENCE_THRESHOLD
    data = data.filter((row) => {
        if (typeof row[1] === "number") {
            return row[1] >= PAGE_SUMMARY_CONFIDENCE_THRESHOLD;
        }
        return parseFloat(row[1]) >= PAGE_SUMMARY_CONFIDENCE_THRESHOLD;
    });

    // loop over data and add text to the markdown array
    // once text reaches MAX_PAGE_SUMMARY_TOKENS stop adding text to that array and push it to the return array
    // then start a new array and repeat until all data has been added to the return array
    // for a new array add the column headers and a row of dashes
    // also add a 20% overlap between arrays so that the last 20% of rows in an array are also the first 20% of rows in the next array
    const returnArray = [];

    while (data.length > 0) {
        const currentArray = [];
        let left = 100;
        let top = 100;
        let right = 0;
        let bottom = 0;
        let tokenCount = 0;

        // Add table header
        currentArray.push("| " + columns.map((column, index) => {
            return column.padEnd(columnWidths[index], " ");
        }).join(" | ") + " |");
        tokenCount += getTokenCount(currentArray[0]);
        currentArray.push("| " + columns.map((column, index) => {
            return "-".repeat(columnWidths[index]);
        }).join(" | ") + " |");
        tokenCount += getTokenCount(currentArray[1]);

        // Loop over data and start adding to the current array
        while (data.length > 0 && tokenCount < MAX_PAGE_SUMMARY_TOKENS) {
            const row = data.shift();
            if (!row) break;
            // add row values to the current array
            currentArray.push("| " + row.map((cell, index) => {
                if (typeof cell === "number") {
                    cell = cell.toFixed(4);
                    cell = cell.toString();
                }
                return cell.padEnd(columnWidths[index], " ");
            }).join(" | ") + " |");
            // add the new token count
            tokenCount += getTokenCount(currentArray[currentArray.length - 1]);
            // check the left, top, right, and bottom values and update if needed
            if (tokenCount < MAX_PAGE_SUMMARY_TOKENS) {
                if (typeof row[2] === "number" && typeof row[3] === "number" && typeof row[4] === "number" && typeof row[5] === "number") {
                    if (row[2] < left) left = row[2];
                    if (row[3] < top) top = row[3];
                    if (row[3] + row[5] > bottom) bottom = row[3] + row[5];
                    if (row[2] + row[4] > right) right = row[2] + row[4];
                }
            }
        }

        // If we went over the token count then remove the last row from the current array
        // Add both that last row, as well as the 20% of the rows on the bottom back to the data array for the overlap
        if (tokenCount > MAX_PAGE_SUMMARY_TOKENS) {
            data.unshift(currentArray.pop()!.slice(2, -2).split(" | ").map((cell) => {
                return cell.trim();
            }));
            const overlapCount = Math.floor(currentArray.length * 0.2);
            for (let i = 0; i < overlapCount; i++) {
                data.unshift(currentArray.pop()!.slice(2, -2).split(" | ").map((cell) => {
                    return cell.trim();
                }));
            }
        }

        // Add the current array to the return array, reset the token count, and reset the left, top, right, and bottom values
        // round directional values to 4 decimal places
        returnArray.push({
            text: currentArray.join("\n"),
            left: left.toFixed(4),
            top: top.toFixed(4),
            right: right.toFixed(4),
            bottom: bottom.toFixed(4)
        });
        tokenCount = 0;
        left = 100;
        top = 100;
        right = 0;
        bottom = 0;
    }

    return returnArray;
});



interface Cell {
    text: string;
    confidence: number;
    columnIndex: number;
    rowIndex: number;
    columnSpan: number;
    rowSpan: number;
}

export const tableMarkdownTableGenerator = ((columns: string[], data: Cell[], initialPrompt: string) => {
    // columns is an array of strings
    // data is an array of cell objects that has strings and numbers

    // remove any rows that have confidence less than TABLE_SUMMARY_CONFIDENCE_THRESHOLD
    // data = data.filter((row) => {
    //     return row.confidence < TABLE_SUMMARY_CONFIDENCE_THRESHOLD;
    // });

    // get the max length of each column
    const columnWidths = columns.map((column, index) => {
        let maxLength = column.length;
        data.forEach((row) => {
            switch (index) {
                case 0:
                    if (row.text.length > maxLength) maxLength = row.text.length;
                    break;
                case 1:
                    if (row.confidence.toFixed(4).length > maxLength) maxLength = row.confidence.toFixed(4).length;
                    break;
                case 2:
                    if (row.columnIndex.toString().length > maxLength) maxLength = row.columnIndex.toString().length;
                    break;
                case 3:
                    if (row.rowIndex.toString().length > maxLength) maxLength = row.rowIndex.toString().length;
                    break;
                case 4:
                    if (row.columnSpan.toString().length > maxLength) maxLength = row.columnSpan.toString().length;
                    break;
                case 5:
                    if (row.rowSpan.toString().length > maxLength) maxLength = row.rowSpan.toString().length;
                    break;
            }
        });
        return maxLength;
    });
    // count how many tokens the initial prompt takes up
    const initialPromptTokenCount = getTokenCount(initialPrompt);

    // initialize return array
    const returnArray = [];

    // loop over data and add text to the markdown array
    // once text reaches MAX_PAGE_SUMMARY_TOKENS stop adding text to that array and push it to the return array
    // then start a new array and repeat until all data has been added to the return array
    // for a new array add the column headers and a row of dashes
    // also add a 20% overlap between arrays so that the last 20% of rows in an array are also the first 20% of rows in the next array
    while (data.length > 0) {
        const currentArray = [];
        let tokenCount = initialPromptTokenCount;

        // Add table header
        currentArray.push("| " + columns.map((column, index) => {
            return column.padEnd(columnWidths[index], " ");
        }).join(" | ") + " |");
        tokenCount += getTokenCount(currentArray[0]);
        currentArray.push("| " + columns.map((column, index) => {
            return "-".repeat(columnWidths[index]);
        }).join(" | ") + " |");
        tokenCount += getTokenCount(currentArray[1]);

        // Loop over data and start adding to the current array
        const cellStore = [];
        while (data.length > 0 && tokenCount < MAX_PAGE_SUMMARY_TOKENS) {
            const cell = data.shift();
            cellStore.push(cell);
            if (!cell) break;
            // add cell values to the current array
            const cellValues = [cell.text, cell.confidence.toFixed(4), cell.columnIndex.toString(), cell.rowIndex.toString(), cell.columnSpan.toString(), cell.rowSpan.toString()];
            currentArray.push("| " + cellValues.map((val, index) => {
                return val.padEnd(columnWidths[index], " ");
            }).join(" | ") + " |");
            // add the new token count
            tokenCount += getTokenCount(currentArray[currentArray.length - 1]);
        }

        // If we went over the token count then remove the last row from the current array
        // Add both that last row, as well as the 20% of the rows on the bottom back to the data array for the overlap
        if (tokenCount > MAX_PAGE_SUMMARY_TOKENS) {
            data.unshift(cellStore.pop()!);
            const overlapCount = Math.floor(data.length * 0.2);
            for (let i = 0; i < overlapCount; i++) {
                data.unshift(cellStore.pop()!);
            }            
        }

        // Add the current array to the return array
        returnArray.push(currentArray.join("\n"));
        tokenCount = initialPromptTokenCount;
    }

    return returnArray;

});


interface kvPair {
    key: string;
    value: string;
    confidence: number;
    left: number;
    top: number;
    right: number;
    bottom: number;
}

export const kvMarkdownTableGenerator = ((columns: string[], data: kvPair[]) => {

    // Filter any rows that have confidence less than KV_SUMMARY_CONFIDENCE_THRESHOLD
    // Also filter out any rows that have a key that is a b;ank string or null
    data = data.filter((row) => {
        return row.confidence >= KV_SUMMARY_CONFIDENCE_THRESHOLD && row.key !== "" && row.key !== null;
    });

    // get the max length of each column
    const columnWidths = columns.map((column, index) => {
        let maxLength = column.length;
        data.forEach((row) => {
            switch (index) {
                case 0:
                    if (row.key.length > maxLength) maxLength = row.key.length;
                    break;
                case 1:
                    if (row.value.length > maxLength) maxLength = row.value.length;
                    break;
                case 2:
                    if (row.confidence.toFixed(4).length > maxLength) maxLength = row.confidence.toFixed(4).length;
                    break;
                case 3:
                    if (row.left.toFixed(4).length > maxLength) maxLength = row.left.toFixed(4).length;
                    break;
                case 4:
                    if (row.top.toFixed(4).length > maxLength) maxLength = row.top.toFixed(4).length;
                    break;
                case 5:
                    if (row.right.toFixed(4).length > maxLength) maxLength = row.right.toFixed(4).length;
                    break;
                case 6:
                    if (row.bottom.toFixed(4).length > maxLength) maxLength = row.bottom.toFixed(4).length;
                    break;
            }
        });
        return maxLength;
    });

    // initialize return array
    const returnArray = [];

    // loop over data and add text to the markdown array
    // once text reaches MAX_PAGE_SUMMARY_TOKENS stop adding text to that array and push it to the return array
    // then start a new array and repeat until all data has been added to the return array
    // for a new array add the column headers and a row of dashes
    // no need for a 20% overlap for KV pairs
    while (data.length > 0) {
        const currentArray = [];
        let tokenCount = 0;
        let left = 100;
        let top = 100;
        let right = 0;
        let bottom = 0;

        // Add table header
        currentArray.push("| " + columns.map((column, index) => {
            return column.padEnd(columnWidths[index], " ");
        }).join(" | ") + " |");
        tokenCount += getTokenCount(currentArray[0]);
        currentArray.push("| " + columns.map((column, index) => {
            return "-".repeat(columnWidths[index]);
        }).join(" | ") + " |");
        tokenCount += getTokenCount(currentArray[1]);

        // Loop over data and start adding to the current array
        let row: kvPair | undefined;
        while (data.length > 0 && tokenCount < MAX_PAGE_SUMMARY_TOKENS) {
            row = data.shift();
            if (!row) break;
            currentArray.push("| " + [row.key, row.value, row.confidence.toFixed(4), row.left.toFixed(4), row.top.toFixed(4), row.right.toFixed(4), row.bottom.toFixed(4)].map((val, index) => {
                return val.padEnd(columnWidths[index], " ");
            }).join(" | ") + " |");
            // add the new token count
            tokenCount += getTokenCount(currentArray[currentArray.length - 1]);
            // update the bounding box
            if (row.left < left) left = row.left;
            if (row.top < top) top = row.top;
            if (row.right > right) right = row.right;
            if (row.bottom > bottom) bottom = row.bottom;
        }

        // If we went over the token count then remove the last row from the current array and add it back to data array
        if (tokenCount > MAX_PAGE_SUMMARY_TOKENS) {
            data.unshift(row!);
            currentArray.pop();
        }

        returnArray.push({
            text: currentArray.join("\n"),
            left: left,
            top: top,
            right: right,
            bottom: bottom
        });
        tokenCount = 0;
        left = 0;
        top = 0;
        right = 100;
        bottom = 100;
    }

    return returnArray;
});


const getTokenCount = ((text: string) => {
    const encoded = gpt3Tokenizer.encode(text);
    return encoded.text.length;
});