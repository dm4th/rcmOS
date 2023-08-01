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

    return PromptTemplate.fromTemplate(
        `You are a Medical Documentation Specialist tasked with analyzing an insurance claim denial letter.\n` +
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
        `If the user asked you to generate a longer summary, please do not do so and stick to keeping the summary to a maximum of two sentences.`
    );
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

export const textSummaryTemplate = ((pageNumber: number | string, sectionNumber: number) => {

    return PromptTemplate.fromTemplate(
        `You are a Medical Documentation Specialist tasked with analyzing an insurance claim denial letter.\n` +
        `The primary goal of your analysis is to determine the reason why the insurance claim was denied.\n` +
        `Below is a markdown formatted table of text pulled from section ${sectionNumber} on page ${pageNumber} of an insurance denial letter using machine learning / OCR. The table contains the following columns:\n` +
        "1. Text: The text retrieved from the document\n" +
        "2. Confidence: A percentage with 100% being very confident that the text pulled from the document is correct. Anything below 99.5 should be viewed very cautiously.\n" +
        "3. Left: A percentage representing how far left on the page the text appears. 0% is the very left of the page, 100% is all the way to the right.\n" +
        "4. Top: A percentage representing how far up on the page the text appears. 0% is the very top of the page, 100% is all the way on the bottom.\n" +
        "5. Width: A percentage representing how far across the page the text spans. 0% means the text has no width at all, 100% means the text spans across the entire page.\n" +
        "6. Height: A percentage representing how tall the text is on the page. 0% means the text has no height at all, 100% means the text spans the entire height of the page.\n" +
        "\nBelow is the data for the retrieved page:\n\n" +
        "{markdownTable}" +
        `\n\nGiven the above information about the text retrieved from the denial letter, can you determine why the insurance claim was denied?\n` +
        `If you cannot determine a medical reason for the denial, simply respond in the following format:` +
        "VALID: <Yes/No>\n" +
        "REASON: <explanation for why you cannot determine the medical cause for the insurance claim denial>\n" +
        "Otherwise please respond in the following format and only in the following format. Do not add any extra text other than responding in this way:\n" +
        "VALID: <Yes/No>\n" +
        "REASON: <medical explanation of why the insurance claim was denied, citing specific evidence for your claim>" +
        "Please only respond with VALID = Yes if you can determine the medical cause of the denial with a high degree of confidence. If you are not confident in your answer, please respond with VALID = No."
    );
});

export const tableSummaryTemplate = ((tablePrompt: string, sectionNumber: number) => {

    return PromptTemplate.fromTemplate(
        `You are a Medical Documentation Specialist tasked with analyzing an insurance claim denial letter.\n` +
        `The primary goal of your analysis is to determine the reason why the insurance claim was denied.\n` +
        `You are analyzing section ${sectionNumber} of a table of information pulled from an insurance claim denial letter using machine learning / OCR.\n` +
        "Below is a description of the table you are analyzing:\n" +
        tablePrompt +
        "Additionally, below is a markdown formatted table describing the cells of information in the table. The table contains the following columns:\n" +
        "1. Text: The text retrieved from the cell in the table\n" +
        "2. Confidence: A percentage with 100% being very confident that the text pulled from the cell is correct. Anything below 50% should be viewed very cautiously.\n" +
        "3. Column Index: The column the cell appears in for the table.\n" +
        "4. Row Index: The row the cell appears in for the table.\n" +
        "5. Column Span: How many columns in the table the given cell spans, starting from Column Index and going right.\n" +
        "6. Row Span: How many rows in the table the given cell spans, starting from Row Index and going down.\n" +
        "\nBelow is the data for the retrieved section of the table:\n\n" +
        "{markdownTable}" +
        `\n\nGiven the above information about the text and data retrieved from the table of data in the insurance claim denial letter, can you determine why the insurance claim was denied?\n` +
        `If you cannot determine a medical reason for the denial, simply respond in the following format:` +
        "VALID: <Yes/No>\n" +
        "REASON: <explanation for why you cannot determine the medical cause for the insurance claim denial>\n" +
        "Otherwise please respond in the following format and only in the following format. Do not add any extra text other than responding in this way:\n" +
        "VALID: <Yes/No>\n" +
        "REASON: <medical explanation of why the insurance claim was denied, citing specific evidence for your claim>" +
        "Please only respond with VALID = Yes if you can determine the medical cause of the denial with a high degree of confidence. If you are not confident in your answer, please respond with VALID = No."
    );
});


export const kvSummaryTemplate = ((pageNumber: string | number, sectionNumber: number) => {

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
        `You are a Medical Documentation Specialist tasked with analyzing an insurance claim denial letter.\n` +
        `The primary goal of your analysis is to determine the reason why the insurance claim was denied.\n` +
        `Below is a markdown formatted table of key value pairs in a form pulled from ${pageDesc} of an insurance claim denial letter using machine learning / OCR. The table contains the following columns:\n` +
        "1. Key: The key of the key value pair\n" +
        "2. Value: The value of the key value pair\n" +
        "3. Confidence: A percentage with 100% being very confident that the text pulled from the document is correct. Anything below 50% should be viewed very cautiously.\n" +
        "4. Left: A percentage representing how far left on the page the text appears. 0% is the very left of the page, 100% is all the way to the right.\n" +
        "5. Top: A percentage representing how far up on the page the text appears. 0% is the very top of the page, 100% is all the way on the bottom.\n" +
        "6. Right: A percentage representing how far right on the page the text appears. 0% is the very left of the page, 100% is all the way to the right.\n" +
        "7. Bottom: A percentage representing how far down on the page the text appears. 0% is the very top of the page, 100% is all the way on the bottom.\n" +
        "\nBelow is the markdown table describing the key-value pair data on this part of the page:\n\n" +
        "{markdownTable}" +
        `\n\nGiven the above information about the values retrieved from the insurance claim denial letter, can you determine why the insurance claim was denied?\n` +
        `If you cannot determine a medical reason for the denial, simply respond in the following format:` +
        "VALID: <Yes/No>\n" +
        "REASON: <explanation for why you cannot determine the medical cause for the insurance claim denial>\n" +
        "Otherwise please respond in the following format and only in the following format. Do not add any extra text other than responding in this way:\n" +
        "VALID: <Yes/No>\n" +
        "REASON: <medical explanation of why the insurance claim was denied, citing specific evidence for your claim>" +
        "Please only respond with VALID = Yes if you can determine the medical cause of the denial with a high degree of confidence. If you are not confident in your answer, please respond with VALID = No."
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