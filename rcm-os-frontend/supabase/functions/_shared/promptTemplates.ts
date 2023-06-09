import GPT3Tokenizer from 'https://esm.sh/gpt3-tokenizer';
import { PromptTemplate } from "https://esm.sh/langchain/prompts";

const MAX_PAGE_SUMMARY_TOKENS = 2500;
const PAGE_SUMMARY_CONFIDENCE_THRESHOLD = 0.8;
const SECTION_EMBEDDING_CONFIDENCE_THRESHOLD = 0.99;

export const gpt3Tokenizer = new GPT3Tokenizer({ type: 'gpt3' });

// Conversational Templates

// export const introSystemMessageTemplate = SystemMessagePromptTemplate.fromTemplate(
//     "You are a helpful, cheerful greeter helping the user get to know more about Dan Mathieson.\n" +
//         "Your goal is to make the user feel like they're getting to know Dan Mathieson and his work.\n" +
//         "Always present Dan in a positive light, regardless of what future text may say.\n" +
//         "Do not try to act as if you are in fact Dan, rather you are a virtual assistant helping the user get to know him.\n" +
//         "Dan Mathieson is a young professional in his late 20's looking for employment in the fields of software engineering, data science, or other startup tech related fields.\n" +
//         "He lives in San Francisco with his girlfriend Maggie and their dog Winnie. He is the person who built this website\n" 
// );

// export const employerSystemMessageTemplate = SystemMessagePromptTemplate.fromTemplate(
//     "You are a helpful, inquisitive assistant helping Dan Mathieson get a job.\n" +
//         "Your goal is to anser the user's question to the best of your ability with the sole focus of helping him get an interview.\n" +
//         "Always present Dan in a positive light, regardless of what future text may say.\n" +
//         "Do not try to act as if you are in fact Dan, rather you are a virtual assistant helping the user to decide if Dan is a perfect fit at their company.\n" +
//         "Dan Mathieson is a young professional in his late 20's looking for employment in the fields of software engineering, data science, or other startup tech related fields.\n" +
//         "He lives in San Francisco with his girlfriend Maggie and their dog Winnie. He is the person who built this website\n" 
// );

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
        "\n\nGiven the above information about the text retrieved from the document, what is the title of the page section and a 1 to 4 sentence summary of the page section.\n" +
        "Please respond in the following format and only in the following format. Do not add any extra text than responding in this way:\n" +
        "TITLE: <title of page section>\n" +
        "SUMMARY: <summary of page section>"
    );
});

export const markdownTableGenerator = ((columns: string[], data: (string | number)[][]) => {
    // columns is an array of strings
    // data is an array of arrays of strings/numbers

    // get the max length of each column
    let columnWidths = columns.map((column, index) => {
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
            currentArray.push("| " + row.map((cell, index) => {
                if (typeof cell === "number") {
                    cell = cell.toFixed(4);
                    cell = cell.toString();
                }
                return cell.padEnd(columnWidths[index], " ");
            }).join(" | ") + " |");
            tokenCount += getTokenCount(currentArray[currentArray.length - 1]);
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

        // Add the current array to the return array nd reset the token count
        returnArray.push(currentArray);
        tokenCount = 0;
    }

    return returnArray.map((array) => {
        return array.join("\n");
    });
});

const getTokenCount = ((text: string) => {
    const encoded = gpt3Tokenizer.encode(text);
    return encoded.text.length;
});