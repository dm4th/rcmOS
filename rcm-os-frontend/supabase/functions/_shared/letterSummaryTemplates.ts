import { PromptTemplate } from "https://esm.sh/langchain/prompts";

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
        `1. Determine the medical reason for why the insurance claim was denied.\n` + 
        '2. Generate a title and summary for the section of the denial letter that you are analyzing.\n' +
        `3. Determine if the text from the letter matches any common data elements listed below.\n` +
        `These are separate goals, so please respond to each one separately. It is possible to find a reason for the denial without finding any common data elements and vice versa, and don't forget to summarize the data you see from the letter regardless.` +
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
        `\n\nGiven the above information about the text retrieved from the denial letter and common data elements to search for, can you determine why the claim was denied and/or find any elements in this text? Can you describe this section of the letter with a title and summary?\n` +
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