import { definePrimitive } from '@ui-sdk/core'
import { createParts } from '@ui-sdk/vue/primitive'

type AreaChartOptions = {
  pointCount?: number
  interactive?: boolean
}

const areaChart = definePrimitive({
  name: 'p0seid0n-area-chart',
  options: { pointCount: 'number', interactive: 'boolean' },
  state: (options: AreaChartOptions) => ({
    pointCount: options.pointCount ?? 0,
    interactive: options.interactive ?? true,
    activeIndex: null as number | null,
  }),
  sync: (options) => ({
    pointCount: options.pointCount ?? 0,
    interactive: options.interactive ?? true,
  }),
  api: ({ store }) => ({
    inspect(event: PointerEvent, plot: HTMLElement) {
      const { interactive, pointCount } = store.get()
      if (!interactive || pointCount <= 0) return
      const rect = plot.getBoundingClientRect()
      if (rect.width <= 0) return
      const fraction = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
      store.set({ activeIndex: Math.round(fraction * (pointCount - 1)) })
    },
    clear() {
      store.set({ activeIndex: null })
    },
  }),
  slots: (slot) => ({
    root: slot({}),
    legend: slot({}),
    plot: slot({
      state: (state) => ({ activeIndex: state.activeIndex }),
      on: {
        pointermove: (event, { api, el }) => {
          if (el) api.inspect(event, el)
        },
        pointerleave: (_, { api }) => api.clear(),
      },
    }),
    axis: slot({}),
  }),
})

export const {
  Root: AreaChartPart,
  Legend: AreaChartLegend,
  Plot: AreaChartPlot,
  Axis: AreaChartAxis,
} = createParts(areaChart, {
  root: 'div',
  legend: 'div',
  plot: 'div',
  axis: 'div',
})
