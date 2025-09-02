import { Component, ViewEncapsulation } from '@angular/core';
import { RouterLink } from '@angular/router';
import { erpAnimations } from '@erp/animations';

@Component({
    selector: 'auth-confirmation-required',
    templateUrl: './confirmation-required.component.html',
    encapsulation: ViewEncapsulation.None,
    animations: erpAnimations,
    imports: [RouterLink]
})
export class AuthConfirmationRequiredComponent {
    /**
     * Constructor
     */
    constructor() {}
}
