const statusOptions = [
  { value: "show_all", text: "Show All" },
  { value: "draft", text: "Draft" },
  { value: "submitted", text: "Submitted" },
  { value: "in_progress", text: "In progress" },
  { value: "cancelled", text: "Cancelled" },
  { value: "samples_overdue", text: "Samples overdue" },
  { value: "tests_complete", text: "All tests complete" },
  { value: "available", text: "Results available" }
];

const dateOptions = [
  { value: "1_day", text: "In the last day"},
  { value: "1_week", text: "In the last week" },
  { value: "14_days", text: "In the last 14 days" },
  { value: "1_month", text: "In the last month" },
  { value: "6_months", text: "In the last 6 months" },
  { value: "1_year", text: "In the last year" },
  { value: "18_months", text: "In the last 18 months"}
];

export function getSelectItems(filteredValues) {
  const submittedDateValue = filteredValues.submitted_date || '18_months';
  return {
    statusItems: statusOptions.map(item => ({
      ...item,
      selected: item.value === filteredValues.status
    })),
    dateItems: dateOptions.map(item => ({
      ...item,
      selected: item.value === submittedDateValue
    }))
  };
}