import {
    IsActiveMatchOptions,
    Params,
    QueryParamsHandling,
} from '@angular/router';

export interface ErpNavigationItem {
    id?: string;
    title?: string;
    subtitle?: string;
    type: 'aside' | 'basic' | 'collapsable' | 'divider' | 'group' | 'spacer';
    hidden?: (item: ErpNavigationItem) => boolean;
    active?: boolean;
    disabled?: boolean;
    tooltip?: string;
    link?: string;
    fragment?: string;
    preserveFragment?: boolean;
    queryParams?: Params | null;
    queryParamsHandling?: QueryParamsHandling | null;
    externalLink?: boolean;
    target?: '_blank' | '_self' | '_parent' | '_top' | string;
    exactMatch?: boolean;
    isActiveMatchOptions?: IsActiveMatchOptions;
    function?: (item: ErpNavigationItem) => void;
    classes?: {
        title?: string;
        subtitle?: string;
        icon?: string;
        wrapper?: string;
    };
    icon?: string;
    badge?: {
        title?: string;
        classes?: string;
    };
    children?: ErpNavigationItem[];
    meta?: any;
}

export type ErpVerticalNavigationAppearance =
    | 'default'
    | 'compact'
    | 'dense'
    | 'thin';

export type ErpVerticalNavigationMode = 'over' | 'side';

export type ErpVerticalNavigationPosition = 'left' | 'right';
