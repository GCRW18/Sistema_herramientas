import { Component, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import {
    FormsModule,
    NgForm,
    ReactiveFormsModule,
    UntypedFormBuilder,
    UntypedFormGroup,
    Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, Router } from '@angular/router';
import { erpAnimations } from '@erp/animations';
import { ErpAlertComponent, ErpAlertType } from '@erp/components/alert';
import { AuthService } from 'app/core/auth/auth.service';

@Component({
    selector: 'auth-sign-in',
    templateUrl: './sign-in.component.html',
    encapsulation: ViewEncapsulation.None,
    animations: erpAnimations,
    imports: [
        ErpAlertComponent,
        FormsModule,
        ReactiveFormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconModule,
        MatCheckboxModule,
        MatProgressSpinnerModule,
    ]
})
export class AuthSignInComponent implements OnInit {
    @ViewChild('signInNgForm') signInNgForm: NgForm;

    alert: { type: ErpAlertType; message: string } = {
        type: 'success',
        message: '',
    };
    signInForm: UntypedFormGroup;
    showAlert: boolean = false;

    public logo = 'boa_logo_white.png';
    /**
     * Constructor
     */
    constructor(
        private _activatedRoute: ActivatedRoute,
        private _authService: AuthService,
        private _formBuilder: UntypedFormBuilder,
        private _router: Router
    ) {}

    // -----------------------------------------------------------------------------------------------------
    // @ Lifecycle hooks
    // -----------------------------------------------------------------------------------------------------

    /**
     * On init
     */
    ngOnInit(): void {
        // Create the form
        this.signInForm = this._formBuilder.group({
            email: ['',[Validators.required]],
            password: ['', Validators.required],
            rememberMe: [''],
        });
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Sign in
     */
    signIn(): void {
        console.log('[SignInComponent] Iniciando proceso de login...');

        // Return if the form is invalid
        if (this.signInForm.invalid) {
            console.warn('[SignInComponent] Formulario inválido');
            return;
        }

        console.log('[SignInComponent] Deshabilitando formulario...');
        // Disable the form
        this.signInForm.disable();

        // Hide the alert
        this.showAlert = false;

        console.log('[SignInComponent] Llamando al servicio de autenticación...');
        const componentStart = performance.now();

        // Sign in
        this._authService.signIn(this.signInForm.value).subscribe({
            next: (response) => {
                const componentEnd = performance.now();
                console.log(`[SignInComponent] Respuesta recibida en ${(componentEnd - componentStart).toFixed(2)}ms`);
                console.log('[SignInComponent] Respuesta:', response);

                if (!response.error) {
                    console.log('[SignInComponent] Login exitoso, redirigiendo...');

                    // Set the redirect url.
                    // The '/signed-in-redirect' is a dummy url to catch the request and redirect the user
                    // to the correct page after a successful sign in. This way, that url can be set via
                    // routing file and we don't have to touch here.
                    const redirectURL = this._activatedRoute.snapshot.queryParamMap.get('redirectURL') || '/signed-in-redirect';

                    console.log('[SignInComponent] Redirigiendo a:', redirectURL);
                    // Navigate to the redirect url
                    this._router.navigateByUrl(redirectURL);
                } else {
                    console.warn('[SignInComponent] Error en login:', response.message);

                    // Re-enable the form
                    this.signInForm.enable();

                    // Set the alert
                    this.alert = {
                        type: 'error',
                        message: response.message || 'Error al iniciar sesión',
                    };

                    // Show the alert
                    this.showAlert = true;
                }
            },
            error: (error) => {
                const componentEnd = performance.now();
                console.error(`[SignInComponent] Error después de ${(componentEnd - componentStart).toFixed(2)}ms`);
                console.error('[SignInComponent] Error:', error);

                // Re-enable the form
                this.signInForm.enable();

                // Set the alert
                this.alert = {
                    type: 'error',
                    message: error.message || 'Error de conexión con el servidor. Por favor, verifica tu conexión e intenta nuevamente.',
                };

                // Show the alert
                this.showAlert = true;
            }
        });
    }
}
