import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MinimizedDialogsBarComponent } from './shared/components/minimized-dialogs-bar/minimized-dialogs-bar.component';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss'],
    imports: [
        RouterOutlet,
        MinimizedDialogsBarComponent
    ]
})
export class AppComponent {
    /**
     * Constructor
     */
    constructor() {}
}
