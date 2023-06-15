import GPT3Tokenizer from 'https://esm.sh/gpt3-tokenizer';
import { PromptTemplate } from "https://esm.sh/langchain/prompts";

const MAX_PAGE_SUMMARY_TOKENS = 3000;
const PAGE_SUMMARY_CONFIDENCE_THRESHOLD = 0.8;
const TABLE_SUMMARY_CONFIDENCE_THRESHOLD = 0.8;

export const gpt3Tokenizer = new GPT3Tokenizer({ type: 'gpt3' });

export const pageSectionSummaryTemplate = ((pageNumber: number | string, sectionNumber: number, markdownTable: string) => {

    // pageData is a string with a markdown formmated table of contents

    return PromptTemplate.fromTemplate(
        `Below is a markdown formatted table of text pulled from section ${sectionNumber} on page ${pageNumber} of a medical record using machine learning. The table contains the following columns:\n` +
        "1. Text: The text retrieved from the document\n" +
        "2. Confidence: A percentage with 100% being very confident that the text pulled from the document is correct. Anything below 99.5 should be viewed very cautiously.\n" +
        "3. Left: A percentage representing how far left on the page the text appears. 0% is the very left of the page, 100% is all the way to the right.\n" +
        "4. Top: A percentage representing how far up on the page the text appears. 0% is the very top of the page, 100% is all the way on the bottom.\n" +
        "5. Width: A percentage representing how far across the page the text spans. 0% means the text has no width at all, 100% means the text spans across the entire page.\n" +
        "6. Height: A percentage representing how tall the text is on the page. 0% means the text has no height at all, 100% means the text spans the entire height of the page.\n" +
        "\nBelow is the data for the retrieved page:\n\n" +
        markdownTable +
        "\n\nGiven the above information about the text retrieved from the document, what is the title of the page section and a 1 to 2 paragraph summary of the page section.\n" +
        "Please respond in the following format and only in the following format. Do not add any extra text than responding in this way:\n" +
        "TITLE: <title of page section>\n" +
        "SUMMARY: <summary of page section>"
    );
});

export const tableSectionSummaryTemplate = ((tablePrompt: string, sectionNumber: number, markdownTable: string) => {

    return PromptTemplate.fromTemplate(
        `Below is a description of section ${sectionNumber} of a table pulled from a medical record using machine learning. The table has the following characteristics:\n` +
        tablePrompt +
        "\nBelow is a markdown formatted table describing the cells of data found in the described section of this table. Here are calumn descriptions for the markdown table:\n\n" +
        // const markdownHeaders = ["Text", "Confidence", "Column Index", "Row Index", "Column Span", "Row Span"];
        "1. Text: The text retrieved from the cell in the table\n" +
        "2. Confidence: A percentage with 100% being very confident that the text pulled from the cell is correct. Anything below 50% should be viewed very cautiously.\n" +
        "3. Column Index: The column the cell appears in for the table.\n" +
        "4. Row Index: The row the cell appears in for the table.\n" +
        "5. Column Span: How many columns in the table the given cell spans, starting from Column Index and going right.\n" +
        "6. Row Span: How many rows in the table the given cell spans, starting from Row Index and going down.\n" +
        "\nBelow is the data for the retrieved section of the table:\n\n" +
        markdownTable +
        "\n\nGiven the above information about the text and data retrieved from the table, what is the title of the information and a 1 to 2 paragraph summary of the table section.\n" +
        "Please respond in the following format and only in the following format. Do not add any extra text than responding in this way:\n" +
        "TITLE: <title of table section>\n" +
        "SUMMARY: <summary of table section>"
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



const getTokenCount = ((text: string) => {
    const encoded = gpt3Tokenizer.encode(text);
    return encoded.text.length;
});