export function sliderStepMax(min: number, max: number, step: number) {
  if (step <= 0 || max <= min) return max
  const steps = (max - min) / step
  return Number(
    (min + Math.floor(steps + Number.EPSILON * Math.max(1, steps)) * step).toPrecision(15),
  )
}

export function reverseSliderValues(values: number[], min: number, max: number) {
  return values.map((value) => Number((max - (value - min)).toPrecision(15))).reverse()
}
