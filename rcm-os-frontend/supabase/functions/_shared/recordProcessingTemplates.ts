import { PromptTemplate } from "https://esm.sh/langchain/prompts";

export const textSectionTemplate = ((outputFixingParser: Any) => {

    return new PromptTemplate({
        template: `You are a Medical Documentation Specialist tasked with analyzing a patient's medical record.\n` +
        `Your objectives are:\n` +
        `1. Analyze a section of a patient's medical record and determine whether or not the provided information can help generate an insurance denial appeal letter. The reason for the insurance claim denial will be provided shortly.\n` + 
        '2. Generate a title and summary for the section of the medical record that you are analyzing.\n' +
        `3. Determine if the text from the letter matches any common medical record data elements listed below.\n` +
        `These are separate goals, so please respond to each one separately. It is possible to find that the section of the medical record will be quite valuable in generating an appeal letter without finding any data elements and vice versa. Please don't forget to summarize the data you see from the letter regardless.\n\n` +
        `The reason you are analyzing this section of the medical record is because the patient's insurance claim was denied. The reason for the denial is:\n` +
        "REASON FOR DENIAL: {reasonForDenial}\n\n" +
        `Below is a markdown formatted table of text pulled from section {sectionNumber} on page {pageNumber} of a patient's medical record using machine learning / OCR. The table contains the following columns:\n` +
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
        `\n\nGiven the above information about the reason for the insurance claim denial, the text retrieved from the patient's medical record, and common data elements to search for, will this information help to generate an appeal letter and/or did you find any common data elements? Can you describe this section of the medical record with a title and summary?\n` +
        'Remember that adjacent and nearby text can be used to help determine the meaning of the text you are looking at. Please feel free to cite other records in the parsed medical record markdown table above as you search for reasons to appeal the denial and common data elements.\n' +
        'It is more important to return common data elements than exclude them, so please err on the side of returning data elements if you are unsure. Simply indicate your certainty in your confidence score for that match. Please use the full range of 0-1 when letting me know how confident you are in your match.\n\n' +
        "{formatInstructions}",
        inputVariables: ['pageNumber', 'sectionNumber', 'reasonForDenial', 'markdownTable', 'dataElementsTable'],
        partialVariables: {
            formatInstructions: outputFixingParser.getFormatInstructions()
        }
    });
});