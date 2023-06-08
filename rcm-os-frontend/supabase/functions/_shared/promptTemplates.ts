// import GPT3Tokenizer from 'https://esm.sh/gpt3-tokenizer';
import { PromptTemplate } from "https://esm.sh/langchain/prompts";

// const MAX_PROMPT_TOKENS = 3000;
// export const gpt3Tokenizer = new GPT3Tokenizer({ type: 'gpt3' });

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

export const pageSummaryTemplate = (() => {

    // pageData is a string with a markdown formmated table of contents

    return PromptTemplate.fromTemplate(
        "Below is a markdown formatted table of text pulled from page {pageNumber} of a medical record using machine learning. The table contains the following columns:\n" +
        "1. Text: The text retrieved from the document\n" +
        "2. Confidence: A percentage with 100% being very confident that the text pulled from the document is correct. Anything below 99.5 should be viewed cautiously.\n" +
        "3. Left: A percentage representing how far left on the page the text appears. 0% is the very left of the page, 100% is all the way to the right.\n" +
        "4. Top: A percentage representing how far up on the page the text appears. 0% is the very top of the page, 100% is all the way on the bottom.\n" +
        "5. Width: A percentage representing how far across the page the text spans. 0% means the text has no width at all, 100% means the text spans across the entire page.\n" +
        "6. Height: A percentage representing how tall the text is on the page. 0% means the text has no height at all, 100% means the text spans the entire height of the page.\n" +
        "\nBelow is the data for the retrieved page:\n\n" +
        "{pageMarkdown}" +
        "\n\nGiven the above information about the text retrieved from the document, what is the title of the page and give me a 1 to 4 sentence summary of the page.\n" +
        "Please respond in the following format and only in the following format. Do not add any extra text than responding in this way:\n" +
        "TITLE: <title of page>\n" +
        "SUMMARY: <summary of page>"
    );
});