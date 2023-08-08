-- Create Table to store common data elements for claims processing

CREATE TABLE "public"."common_data_elements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "field" "text" NOT NULL,
    "medical_terms" "text",
    "description" "text" NOT NULL,
    "document_type" "text" NOT NULL,
    "additional_llm_instructions" "text"
);

ALTER TABLE "public"."common_data_elements" OWNER TO "postgres";

ALTER TABLE ONLY "public"."common_data_elements"
    ADD CONSTRAINT "data_elements_pkey" PRIMARY KEY ("id");

-- RLS not needed for this table as it's just a large data store for common elements

GRANT ALL ON TABLE "public"."claims" TO "anon";
GRANT ALL ON TABLE "public"."claims" TO "authenticated";
GRANT ALL ON TABLE "public"."claims" TO "service_role";

-- Insert common data elements into table
INSERT INTO "public"."common_data_elements" ("field", "medical_terms", "description", "document_type", "additional_llm_instructions")
VALUES 
    ('Patient Name', NULL, 'Name of the patient', 'all', NULL),
    ('Hospital Account Number', NULL, 'Account number for the hospital', 'all', NULL),
    ('Hospital Medical Record Number', NULL, 'Medical record number from the hospital', 'all', NULL),
    ('Hospital Name', NULL, 'Name of the hospital', 'all', NULL),
    ('Dates of Service (DOS)', NULL, 'Dates for medical service to the patient at the hospital', 'all', NULL),
    ('Date of Birth', NULL, 'Date of birth for the patient', 'all', NULL),
    ('Discharge Code', NULL, 'Code pertaining to the reason for discharging the patient', 'all', NULL),
    ('Payer', NULL, 'The entity responsible for payment for medical services rendered', 'all', NULL),
    ('Date/Time of IP Order', NULL, 'Date and time of the order for inpatient services', 'all', NULL),
    ('Date/Time of Discharge', NULL, 'Date and time of the discharge of the patient', 'all', NULL),
    ('IP Time Elapsed', NULL, 'Time elapsed for the inpatient services', 'none', NULL),
    ('Authorization Number', NULL, 'Number for the authorization of the medical services', 'all', NULL),
    ('CARC Code / Issue Category', NULL, 'Code for the reason for denial of the claim', 'all', NULL),
    ('Appeal/Recon Date', NULL, 'Date of the appeal or reconsideration of the claim', 'all', NULL),
    ('Claim Date', NULL, 'Date of the claim for timely filing', 'all', NULL),
    ('Primary Diagnosis Code', NULL, 'Primary diagnosis code for the patient', 'all', NULL),
    ('Past Medical History Diagnoses', NULL, 'Past medical history diagnoses for the patient', 'all', NULL),
    ('Temperature', 'Afebrile, Febrile', 'Patient temperature', 'medical_record', NULL),
    ('Heart Rate (HR)', 'Tachycardia (elevated heart rate), Bradycardia (slow heart rate)', 'Patient heart rate', 'medical_record', NULL),
    ('Respiratory Rate (RR)', 'Apnea', 'Patient respiratory rate', 'medical_record', NULL),
    ('Blood Pressure (BP)', 'Hypotension (low BP), Hypertension (high BP)', 'Patient blood pressure', 'medical_record', NULL),
    ('Oxygen Saturation', 'Hypoxia/Hypoxemia (Oxygen Saturation level)', 'Patient oxygen saturation', 'medical_record', NULL),
    ('Pain', NULL, 'Patient pain level', 'medical_record', NULL),
    ('WBC Count', 'Leukocytosis', 'Patient white blood cell count', 'medical_record', NULL),
    ('Potassium (K)', 'Hyperkalemia (high Potassium level) Hypokalemia (low Potassium level)', 'Patient potassium level', 'medical_record', NULL),
    ('Hemoglobin (HGB)', 'Anemia', 'Patient hemoglobin level', 'medical_record', NULL),
    ('Glucose (GLU)', 'Hypoglycemia (low blood sugar) Hyperglycemia (high blood sugar)', 'Patient glucose level', 'medical_record', NULL),
    ('Intubation/Mechanical Ventilation', NULL, 'Patient on ventilator', 'medical_record', NULL),
    ('Bipap', NULL, 'Device for breathing', 'medical_record', NULL),
    ('Infection/Infectious Process/Sepsis', NULL, 'Patient infection', 'medical_record', NULL),
    ('Altered Mental Status/Confusion/Delirium', NULL, 'Patient altered mental status', 'medical_record', NULL),
    ('Intensive Care', NULL, 'Patient is critical', 'medical_record', NULL),
    ('Procedure/Surgery', NULL, 'Name of surgery/procedure', 'medical_record', 'Be sure to cite the surgical operation specifically'),
    ('IV Medications', 'IV medications (Intravenous)', 'Patient IV medications', 'medical_record', NULL),
    ('Abnormal', NULL, 'Physicians will use this word to indicate results or findings are not within normal limits', 'medical_record', NULL),
    ('Electolytes', NULL, 'Patient had multiple labs done for abnormal electrolyte levels', 'medical_record', NULL),
    ('Abnormal', NULL, 'Something atypical is happening to the patient', 'medical_record', 'Be sure to cite specifically what the abnormality is related too'),
    ('EKG Result/Impression', 'EKG, Electrocardiogram', 'Electrical tracing of patient heart rhythm', 'medical_record', NULL),
    ('Imaging Results', 'X-Ray, CT, MRI, etc.', 'Results from patient imaging scans', 'medical_record', NULL);