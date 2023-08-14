ALTER TABLE "public"."letter_sections" 
DROP COLUMN "valid";

ALTER TABLE "public"."document_data_elements"
ADD COLUMN "confidence" FLOAT4 NOT NULL;

UPDATE "public"."common_data_elements"
SET "additional_llm_instructions" = 'Please only return dates formatted as mm/dd/yyyy. To cite this data element, you must be certain that this date pertains to dates of service for the patient at the hospital and not to anything else.'
WHERE "field" = 'Dates of Service (DOS)';

UPDATE "public"."common_data_elements"
SET "additional_llm_instructions" = 'Please only return dates formatted as mm/dd/yyyy. To cite this data element, you must be certain that this date pertains to the date of birth for the patient and not to anything else.'
WHERE "field" = 'Date of Birth';

UPDATE "public"."common_data_elements"
SET "additional_llm_instructions" = 'Please only return dates formatted as mm/dd/yyyy or a time in mm/dd/yyyy HH:MM:SS format. To cite this data element, you must be certain that this date pertains to the date and time of the order for inpatient services and not to anything else.'
WHERE "field" = 'Date/Time of IP Order';

UPDATE "public"."common_data_elements"
SET "additional_llm_instructions" = 'Please only return dates formatted as mm/dd/yyyy or a time in mm/dd/yyyy HH:MM:SS format. To cite this data element, you must be certain that this date pertains to the date and time of the discharge of the patient and not to anything else.'
WHERE "field" = 'Date/Time of Discharge';

UPDATE "public"."common_data_elements"
SET "additional_llm_instructions" = 'Please only return dates formatted as mm/dd/yyyy. To cite this data element, you must be certain that this date pertains to the date of the appeal or reconsideration of the claim and not to anything else.'
WHERE "field" = 'Appeal/Recon Date';

UPDATE "public"."common_data_elements"
SET "additional_llm_instructions" = 'Please only return dates formatted as mm/dd/yyyy. To cite this data element, you must be certain that this date pertains to the date of the claim for timely filing and not to anything else.'
WHERE "field" = 'Claim Date';

UPDATE "public"."common_data_elements"
SET "description" = 'The Claim Adjustment Reason code provided by the payer reagarding why adjsutments or denials were made.'
WHERE "field" = 'CARC Code / Issue Category';

UPDATE "public"."common_data_elements"
SET "additional_llm_instructions" = 'A CARC is broken up by a group code made up of two letters and a numeric value plus a possible letter in front of the numeric value. Please be sure to only provide a code that fits this format.'
WHERE "field" = 'CARC Code / Issue Category';