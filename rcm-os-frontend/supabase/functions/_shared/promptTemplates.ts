import GPT3Tokenizer from 'https://esm.sh/gpt3-tokenizer';
import { HumanMessagePromptTemplate, SystemMessagePromptTemplate, PromptTemplate } from "https://esm.sh/langchain/prompts";

const MAX_CITATION_TOKENS = 2500;
const MAX_CHAT_HISTORY_TOKENS = 500;

const MAX_PAGE_SUMMARY_TOKENS = 3000;
const PAGE_SUMMARY_CONFIDENCE_THRESHOLD = 0.8;
const TABLE_SUMMARY_CONFIDENCE_THRESHOLD = 0.8;
const KV_SUMMARY_CONFIDENCE_THRESHOLD = 0.8;

export const gpt3Tokenizer = new GPT3Tokenizer({ type: 'gpt3' });

interface InputTemplate {
    id: string;
    title: string;
    description: string;
    role: string;
    goal: string;
}

export const chatRolePrompt = ((inputTemplate: InputTemplate) => {
    return SystemMessagePromptTemplate.fromTemplate(
        `You are a ${inputTemplate.role} helping the user understand a questions they have about ${inputTemplate.description}.\n` +
        `Your goal is to provide a summary of cited passages that contextually fit with the user's prompt (shared below) and their stated goal of ${inputTemplate.goal}.\n` +
        "You can use the chat history (also shared below) to help you understand the context of the user's prompt. Please focus on summarizing the cited information first and foremost though.\n" +
        "You may not make up any information that is not explicitly stated in the cited passages. You may come to conclusions about the cited information using your abilities as an LLM though.\n" +
        "If no cited information is given, you may respond to the best of your ability but be sure to let the user know that you found no relevant information in the document.\n"
    );
});

interface ChatHistory {
    prompt: string;
    response: string;
}

export const chatHistoryTemplate = ((chatHistory: ChatHistory[]) => {
    if (chatHistory.length === 0) {
        return SystemMessagePromptTemplate.fromTemplate(
            "There is no chat history yet. Simply focus on summarizing the cited information."
        );
    }

    const chatHistoryStart = "CHAT HISTORY:\n\n"
    const chatHistoryEnd = "When you respond it is very important to not include the prompt or the preceding text 'RESPONSE: '. Simply add your response as if you were in normal conversation.\n\n";
    let tokenCount = gpt3Tokenizer.encode(chatHistoryStart + chatHistoryEnd).length;
    let chatHistoryString = "";
    for (let i = 0; i < chatHistory.length; i++) {
        const chatHistoryItem = chatHistory[i];
        const chatHistoryItemString = `PROMPT: ${chatHistoryItem.prompt}\nRESPONSE: ${chatHistoryItem.response}\n\n`;
        tokenCount += gpt3Tokenizer.encode(chatHistoryItemString).length;
        if (tokenCount > MAX_CHAT_HISTORY_TOKENS) {
            break;
        }
        chatHistoryString = chatHistoryItemString + chatHistoryString;
    }

    return SystemMessagePromptTemplate.fromTemplate(
        chatHistoryStart + chatHistoryString + chatHistoryEnd
    );
});

interface Citation {
    type: string;
    page: number;
    title: string;
    summary: string;
    left: number;
    top: number;
    right: number;
    bottom: number;
    similarity: number;
}

export const documentCitationTemplate = ((citations: Citation[]) => {
    if (citations.length === 0) {
        return SystemMessagePromptTemplate.fromTemplate(
            "No relevant information was found. Please alert the user to this fact and kindly ask them to ask a more relevant question."
        );
    }

    const citationsStart = "CITATIONS:\n\n"
    const citationsEnd = "When you respond it is very important to not include the prompt or the preceding text 'CITATION: '. Simply add your summary of the information as if you were in normal conversation.\n\n";
    let tokenCount = gpt3Tokenizer.encode(citationsStart).length;
    let citationsString = "";
    for (let i = 0; i < citations.length; i++) {
        const citation = citations[i];

        let citationStrength = "weak";
        if (citation.similarity > 0.82) {
            citationStrength = "strong";
        }
        else if (citation.similarity > 0.79) {
            citationStrength = "good";
        }
        else if (citation.similarity > 0.76) {
            citationStrength = "moderate";
        }

        const citationItemString = `Citation ${i + 1}:\n` +
            `Type: ${citation.type}\n` +
            `Page: ${citation.page}\n` +
            `Title: ${citation.title}\n` +
            `Summary: ${citation.summary}\n` +
            `Similarity: ${citation.similarity} - ${citationStrength}\n`;
        tokenCount += gpt3Tokenizer.encode(citationItemString).length;
        if (tokenCount > MAX_CITATION_TOKENS) {
            break;
        }
        citationsString += citationItemString + "\n";
    }

    return SystemMessagePromptTemplate.fromTemplate(
        citationsStart + citationsString
    );
});

export const humanMessageTemplate = HumanMessagePromptTemplate.fromTemplate("USER PROMPT: {human_prompt}");

interface InputTemplate {
    id: string;
    title: string;
    description: string;
    role: string;
    goal: string;
};

export const pageSectionSummaryTemplate = ((pageNumber: number | string, sectionNumber: number, markdownTable: string, inputTemplate: InputTemplate) => {

    return PromptTemplate.fromTemplate(
        `You are a ${inputTemplate.role} helping the user achieve their goal of ${inputTemplate.goal}.\n` +
        `Below is a markdown formatted table of text pulled from section ${sectionNumber} on page ${pageNumber} of a ${inputTemplate.description} using machine learning. The table contains the following columns:\n` +
        "1. Text: The text retrieved from the document\n" +
        "2. Confidence: A percentage with 100% being very confident that the text pulled from the document is correct. Anything below 99.5 should be viewed very cautiously.\n" +
        "3. Left: A percentage representing how far left on the page the text appears. 0% is the very left of the page, 100% is all the way to the right.\n" +
        "4. Top: A percentage representing how far up on the page the text appears. 0% is the very top of the page, 100% is all the way on the bottom.\n" +
        "5. Width: A percentage representing how far across the page the text spans. 0% means the text has no width at all, 100% means the text spans across the entire page.\n" +
        "6. Height: A percentage representing how tall the text is on the page. 0% means the text has no height at all, 100% means the text spans the entire height of the page.\n" +
        "\nBelow is the data for the retrieved page:\n\n" +
        markdownTable +
        `\n\nGiven the above information about the text retrieved from the ${inputTemplate.description}, what is the title of the page section and a 1 to 2 paragraph summary of the page section.\n` +
        `In your summary please be as specific as possible about what information is contained in the text and how it pertains to the goal of ${inputTemplate.goal}. Cite specific names, numbers, dates and other unique items explicitly.\n` +
        "Please respond in the following format and only in the following format. Do not add any extra text than responding in this way:\n" +
        "TITLE: <title of page section>\n" +
        "SUMMARY: <summary of page section>"
    );
});

export const tableSectionSummaryTemplate = ((tablePrompt: string, sectionNumber: number, markdownTable: string, inputTemplate: InputTemplate) => {

    return PromptTemplate.fromTemplate(
        `You are a ${inputTemplate.role} helping the user achieve their goal of ${inputTemplate.goal}.\n` +
        `Below is a description of section ${sectionNumber} of a table pulled from a ${inputTemplate.description} using machine learning. The table has the following characteristics:\n` +
        tablePrompt +
        "\nBelow is a markdown formatted table describing the cells of data found in the described section of this table. Here are calumn descriptions for the markdown table:\n\n" +
        "1. Text: The text retrieved from the cell in the table\n" +
        "2. Confidence: A percentage with 100% being very confident that the text pulled from the cell is correct. Anything below 50% should be viewed very cautiously.\n" +
        "3. Column Index: The column the cell appears in for the table.\n" +
        "4. Row Index: The row the cell appears in for the table.\n" +
        "5. Column Span: How many columns in the table the given cell spans, starting from Column Index and going right.\n" +
        "6. Row Span: How many rows in the table the given cell spans, starting from Row Index and going down.\n" +
        "\nBelow is the data for the retrieved section of the table:\n\n" +
        markdownTable +
        `\n\nGiven the above information about the text and data retrieved from the table of data in ${inputTemplate.description}, what is the title of the information and a 1 to 2 paragraph summary of the table section.\n` +
        `In your summary please be as specific as possible about what information is contained in the table and how it pertains to the goal of ${inputTemplate.goal}. Cite specific names, numbers, dates and other unique items explicitly.\n` +
        "Please respond in the following format and only in the following format. Do not add any extra text than responding in this way:\n" +
        "TITLE: <title of table section>\n" +
        "SUMMARY: <summary of table section>"
    );
});


export const kvSectionSummaryTemplate = ((pageNumber: string | number, sectionNumber: number, markdownTable: string, inputTemplate: InputTemplate) => {

    let pageSection: string; 
    switch (sectionNumber) {
        case 0:
            pageSection = "top";
            break;
        case 1:
            pageSection = "middle";
            break;
        case 2:
            pageSection = "bottom";
            break;
        default:
            pageSection = "unknown";
    };

    const pageDesc = `the ${pageSection} part of page ${pageNumber}`;



    return PromptTemplate.fromTemplate(
        `You are a ${inputTemplate.role} helping the user achieve their goal of ${inputTemplate.goal}.\n` +
        `Below is a markdown formatted table of key value pairs in a form pulled from ${pageDesc} of a ${inputTemplate.description} using machine learning. The table contains the following columns:\n` +
        "1. Key: The key of the key value pair\n" +
        "2. Value: The value of the key value pair\n" +
        "3. Confidence: A percentage with 100% being very confident that the text pulled from the document is correct. Anything below 50% should be viewed very cautiously.\n" +
        "4. Left: A percentage representing how far left on the page the text appears. 0% is the very left of the page, 100% is all the way to the right.\n" +
        "5. Top: A percentage representing how far up on the page the text appears. 0% is the very top of the page, 100% is all the way on the bottom.\n" +
        "6. Right: A percentage representing how far right on the page the text appears. 0% is the very left of the page, 100% is all the way to the right.\n" +
        "7. Bottom: A percentage representing how far down on the page the text appears. 0% is the very top of the page, 100% is all the way on the bottom.\n" +
        "\nBelow is the markdown table describing the key-value pair data on this part of the page:\n\n" +
        markdownTable +
        `\n\nGiven the above information about the text retrieved from the ${inputTemplate.description}, what is the title of the form section and a 1 to 2 paragraph summary of the form section.\n` +
        `In your summary please be as specific as possible about what information is contained in the form section and how it pertains to the goal of ${inputTemplate.goal}. Cite specific names, numbers, dates and other unique items explicitly.\n` +
        "Please respond in the following format and only in the following format. Do not add any extra text than responding in this way:\n" +
        "TITLE: <title of form section>\n" +
        "SUMMARY: <summary of form section>"
    );
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