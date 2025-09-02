import { BooleanInput, coerceBooleanProperty } from '@angular/cdk/coercion';

import {
    Component,
    HostBinding,
    Input,
    OnChanges,
    SimpleChanges,
    ViewEncapsulation,
} from '@angular/core';
import { erpAnimations } from '@erp/animations';
import { ErpCardFace } from '@erp/components/card/card.types';

@Component({
    selector: 'erp-card',
    templateUrl: './card.component.html',
    styleUrls: ['./card.component.scss'],
    encapsulation: ViewEncapsulation.None,
    animations: erpAnimations,
    exportAs: 'erpCard',
    standalone: true,
    imports: [],
})
export class ErpCardComponent implements OnChanges {
    /* eslint-disable @typescript-eslint/naming-convention */
    static ngAcceptInputType_expanded: BooleanInput;
    static ngAcceptInputType_flippable: BooleanInput;
    /* eslint-enable @typescript-eslint/naming-convention */

    @Input() expanded: boolean = false;
    @Input() face: ErpCardFace = 'front';
    @Input() flippable: boolean = false;

    // -----------------------------------------------------------------------------------------------------
    // @ Accessors
    // -----------------------------------------------------------------------------------------------------

    /**
     * Host binding for component classes
     */
    @HostBinding('class') get classList(): any {
        /* eslint-disable @typescript-eslint/naming-convention */
        return {
            'erp-card-expanded': this.expanded,
            'erp-card-face-back': this.flippable && this.face === 'back',
            'erp-card-face-front': this.flippable && this.face === 'front',
            'erp-card-flippable': this.flippable,
        };
        /* eslint-enable @typescript-eslint/naming-convention */
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Lifecycle hooks
    // -----------------------------------------------------------------------------------------------------

    /**
     * On changes
     *
     * @param changes
     */
    ngOnChanges(changes: SimpleChanges): void {
        // Expanded
        if ('expanded' in changes) {
            // Coerce the value to a boolean
            this.expanded = coerceBooleanProperty(
                changes.expanded.currentValue
            );
        }

        // Flippable
        if ('flippable' in changes) {
            // Coerce the value to a boolean
            this.flippable = coerceBooleanProperty(
                changes.flippable.currentValue
            );
        }
    }
}
