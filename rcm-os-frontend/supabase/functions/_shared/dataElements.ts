import { supabaseClient } from '../_shared/supabaseClient.ts';

export const commonDataElementsMarkdown = async (docType: string[] | undefined) => {

    const docTypeArray = ['all'];
    if (docType) {
        docTypeArray.push(...docType);
    }

    const { data: dataElementsTable, error: dataElementsTableError } = await supabaseClient
        .from('common_data_elements')
        .select('id, field, medical_terms, description, additional_llm_instructions')
        .in('document_type',docTypeArray);
    if (dataElementsTableError) {
        throw new Error(dataElementsTableError.message);
    }

    // Create a markdown table from the data element schema
    const markdownHeaders = ["ID", "Field", "Medical Terms", "Description", "Additional LLM Instructions"];
    const markdownArray = dataElementsTable.map((element: any) => {
        return [
            element.id ? element.id : "",
            element.field ? element.field : "",
            element.medical_terms ? element.medical_terms : "",
            element.description ? element.description : "",
            element.additional_llm_instructions ? element.additional_llm_instructions : "",
        ];
    });
    
    const columnWidths = markdownHeaders.map((column, index) => {
        let maxLength = column.length;
        markdownArray.forEach((row) => {
            if (row[index].toString().length > maxLength) {
                maxLength = row[index].toString().length;
            }
        });
        return maxLength;
    });

    // create the markdown header row
    let dataElementsMarkdown = "|";
    for (let i = 0; i < markdownHeaders.length; i++) {
        dataElementsMarkdown += ` ${markdownHeaders[i].padEnd(columnWidths[i])} |`;
    }

    // create the markdown separator row
    dataElementsMarkdown += "\n|";
    for (let i = 0; i < markdownHeaders.length; i++) {
        dataElementsMarkdown += ` ${"".padEnd(columnWidths[i], "-")} |`;
    }

    // create the markdown data rows
    for (let i = 0; i < markdownArray.length; i++) {
        dataElementsMarkdown += "\n|";
        for (let j = 0; j < markdownArray[i].length; j++) {
            dataElementsMarkdown += ` ${markdownArray[i][j].toString().padEnd(columnWidths[j])} |`;
        }
    }

    return { dataElementsTable, dataElementsMarkdown };

}