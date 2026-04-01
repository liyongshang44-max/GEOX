export function computeEffect(before: any, after: any) {
  if (!before?.soil_moisture || !after?.soil_moisture) {
    return null;
  }

  const delta = after.soil_moisture - before.soil_moisture;

  return {
    type: "moisture_increase",
    value: delta
  };
}
