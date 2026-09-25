export type WidgetSize = 'compact_1x1' | 'compact_2x1' | 'compact_2x2' | 'expanded'
export type WidgetAppearance = 'default' | 'transparent' | 'accent' | 'custom'

export interface WidgetProps<TConfig = Record<string, unknown>> {
  size?: WidgetSize
  appearance?: WidgetAppearance
  isEditing?: boolean
  config?: TConfig
  onUpdateConfig?: (patch: Partial<TConfig>) => void
  /** Host request to open the widget settings UI (customize flow). */
  autoOpenSettings?: boolean
  /** Close the settings UI opened via autoOpenSettings. */
  onSettingsClose?: () => void
  /** Stable instance id forwarded by the host; matches widget_activated events. */
  instanceId?: string
  widgetId?: string
}
