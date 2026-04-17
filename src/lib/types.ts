export type FieldStatus = "pass" | "flag" | "fail";
export type OverallStatus = "pass" | "flag" | "fail" | "error";
export type ImageQuality = "good" | "poor";

export interface FieldResult {
  field: string;
  status: FieldStatus;
  extracted_value: string;
  expected_value: string;
  explanation: string;
}

export interface VerificationResult {
  fields: FieldResult[];
  overall_status: OverallStatus;
  image_quality: ImageQuality;
  image_quality_notes?: string;
  processing_time_ms?: number;
}

export interface LabelFields {
  brand_name?: string;
  class_type?: string;
  abv?: string;
  net_contents?: string;
  bottler_name?: string;
  country_of_origin?: string;
}

export interface BatchLabelRecord extends LabelFields {
  filename: string;
}

export interface BatchLabelResult {
  filename: string;
  status: OverallStatus;
  result?: VerificationResult;
  error?: string;
}

export interface BatchSummary {
  total: number;
  passed: number;
  flagged: number;
  failed: number;
  errored: number;
}

export interface BatchVerificationResponse {
  results: BatchLabelResult[];
  summary: BatchSummary;
}
