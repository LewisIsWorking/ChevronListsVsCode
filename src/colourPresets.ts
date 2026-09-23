/** Colour values for a single token type */
export interface TokenColour {
    foreground?: string;
    bold?:       boolean;
    italic?:     boolean;
}

/** A complete named colour preset */
export interface ColourPreset {
    id:          string;
    label:       string;
    description: string;
    tokens: {
        chevronHeader:  TokenColour;
        chevronPrefix:  TokenColour;
        chevronNumber:  TokenColour;
        chevronContent: TokenColour;
        chevronLabel:   TokenColour;
    };
}

/** All built-in colour presets */
export const COLOUR_PRESETS: ColourPreset[] = [
    {
        id: 'default', label: '$(symbol-color) Default',
        description: 'Violet headers · slate prefixes · lime numbers - matches the extension icon',
        tokens: {
            chevronHeader:  { foreground: '#A855F7', bold: true },
            chevronPrefix:  { foreground: '#637880' },
            chevronNumber:  { foreground: '#84CC16' },
            chevronContent: {},
            chevronLabel:   { foreground: '#A855F7', bold: true },
        },
    },
    {
        id: 'classic', label: '$(symbol-color) Classic',
        description: 'Amber headers · grey prefixes · blue numbers - the original default theme',
        tokens: {
            chevronHeader:  { foreground: '#E5C07B', bold: true },
            chevronPrefix:  { foreground: '#5C6370' },
            chevronNumber:  { foreground: '#61AFEF' },
            chevronContent: {},
            chevronLabel:   { foreground: '#E5C07B', bold: true },
        },
    },
    {
        id: 'ocean', label: '$(symbol-color) Ocean',
        description: 'Teal headers · slate prefixes · cyan numbers',
        tokens: {
            chevronHeader:  { foreground: '#56B6C2', bold: true },
            chevronPrefix:  { foreground: '#4B5263' },
            chevronNumber:  { foreground: '#2BBAC5' },
            chevronContent: {},
            chevronLabel:   { foreground: '#56B6C2', bold: true },
        },
    },
    {
        id: 'forest', label: '$(symbol-color) Forest',
        description: 'Green headers · dark prefixes · lime numbers',
        tokens: {
            chevronHeader:  { foreground: '#98C379', bold: true },
            chevronPrefix:  { foreground: '#3E5730' },
            chevronNumber:  { foreground: '#7CC26E' },
            chevronContent: {},
            chevronLabel:   { foreground: '#98C379', bold: true },
        },
    },
    {
        id: 'sunset', label: '$(symbol-color) Sunset',
        description: 'Coral headers · muted orange prefixes · gold numbers',
        tokens: {
            chevronHeader:  { foreground: '#E06C75', bold: true },
            chevronPrefix:  { foreground: '#6B4C3B' },
            chevronNumber:  { foreground: '#E5C07B' },
            chevronContent: {},
            chevronLabel:   { foreground: '#E06C75', bold: true },
        },
    },
    {
        id: 'monochrome', label: '$(symbol-color) Monochrome',
        description: 'Bold white headers · grey prefixes · silver numbers',
        tokens: {
            chevronHeader:  { foreground: '#FFFFFF', bold: true },
            chevronPrefix:  { foreground: '#5C6370' },
            chevronNumber:  { foreground: '#ABB2BF' },
            chevronContent: {},
            chevronLabel:   { foreground: '#FFFFFF', bold: true },
        },
    },
    {
        id: 'midnight', label: '$(symbol-color) Midnight',
        description: 'Purple headers · indigo prefixes · lavender numbers',
        tokens: {
            chevronHeader:  { foreground: '#C792EA', bold: true },
            chevronPrefix:  { foreground: '#4A4080' },
            chevronNumber:  { foreground: '#A29BFE' },
            chevronContent: {},
            chevronLabel:   { foreground: '#C792EA', bold: true },
        },
    },
    {
        id: 'rose', label: '$(symbol-color) Rose',
        description: 'Pink headers · mauve prefixes · peach numbers',
        tokens: {
            chevronHeader:  { foreground: '#F48FB1', bold: true },
            chevronPrefix:  { foreground: '#6D3B4F' },
            chevronNumber:  { foreground: '#FFAB91' },
            chevronContent: {},
            chevronLabel:   { foreground: '#F48FB1', bold: true },
        },
    },
    {
        id: 'autumn', label: '$(symbol-color) Autumn',
        description: 'Orange headers · brown prefixes · red numbers',
        tokens: {
            chevronHeader:  { foreground: '#FF9800', bold: true },
            chevronPrefix:  { foreground: '#5D3A1A' },
            chevronNumber:  { foreground: '#EF5350' },
            chevronContent: {},
            chevronLabel:   { foreground: '#FF9800', bold: true },
        },
    },
    {
        id: 'arctic', label: '$(symbol-color) Arctic',
        description: 'Ice blue headers · cool grey prefixes · white numbers',
        tokens: {
            chevronHeader:  { foreground: '#89DDFF', bold: true },
            chevronPrefix:  { foreground: '#546E7A' },
            chevronNumber:  { foreground: '#ECEFF1' },
            chevronContent: {},
            chevronLabel:   { foreground: '#89DDFF', bold: true },
        },
    },
    {
        id: 'neon', label: '$(symbol-color) Neon',
        description: 'Bright green headers · dark prefixes · cyan numbers',
        tokens: {
            chevronHeader:  { foreground: '#00FF7F', bold: true },
            chevronPrefix:  { foreground: '#1A2A1A' },
            chevronNumber:  { foreground: '#00E5FF' },
            chevronContent: {},
            chevronLabel:   { foreground: '#00FF7F', bold: true },
        },
    },
    {
        id: 'sepia', label: '$(symbol-color) Sepia',
        description: 'Warm tan headers · brown prefixes · gold numbers',
        tokens: {
            chevronHeader:  { foreground: '#C9A96E', bold: true },
            chevronPrefix:  { foreground: '#7C5C3E' },
            chevronNumber:  { foreground: '#E8C97A' },
            chevronContent: {},
            chevronLabel:   { foreground: '#C9A96E', bold: true },
        },
    },
    {
        id: 'custom', label: '$(symbol-color) Custom',
        description: 'Clear all preset colours - manage manually via settings',
        tokens: {
            chevronHeader:  {},
            chevronPrefix:  {},
            chevronNumber:  {},
            chevronContent: {},
            chevronLabel:   {},
        },
    },
];

/** Finds a preset by id. Returns undefined if not found. */
export function findPreset(id: string): ColourPreset | undefined {
    return COLOUR_PRESETS.find(p => p.id === id);
}
