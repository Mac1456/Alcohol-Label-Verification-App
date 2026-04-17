// Exact government warning text required by the Alcoholic Beverage Labeling Act of 1988.
// Any label deviation from this — including title case, missing words, or reordered text — is a hard fail.
export const TTB_GOVERNMENT_WARNING =
  "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.";

export const FIELD_LABELS: Record<string, string> = {
  brand_name: "Brand Name",
  class_type: "Class / Type",
  abv: "Alcohol Content (ABV)",
  net_contents: "Net Contents",
  bottler_name: "Bottler Name & Address",
  country_of_origin: "Country of Origin",
  government_warning: "Government Warning Statement",
};
