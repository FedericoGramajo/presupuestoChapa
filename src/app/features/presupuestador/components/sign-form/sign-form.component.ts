import {
    ChangeDetectionStrategy, Component, inject, signal,
} from '@angular/core';
import {
    FormControl, FormGroup, ReactiveFormsModule, Validators,
} from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { BudgetService } from '../../../../core/services/budget.service';
import { SignType } from '../../../../core/models/sign.model';
import { CurrencyMaskDirective } from '../../../../shared/directives/currency-mask.directive';

@Component({
    selector: 'app-sign-form',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        ReactiveFormsModule,
        MatFormFieldModule, MatInputModule,
        MatSelectModule, MatButtonModule, MatIconModule,
        CurrencyMaskDirective,
    ],
    templateUrl: './sign-form.component.html',
    styleUrl: './sign-form.component.scss',
})
export class SignFormComponent {
    private readonly budgetService = inject(BudgetService);
    expanded = signal(true);

    form = new FormGroup({
        width: new FormControl<number>(0.60, { nonNullable: true, validators: [Validators.required, Validators.min(0.01)] }),
        height: new FormControl<number>(0.40, { nonNullable: true, validators: [Validators.required, Validators.min(0.01)] }),
        type: new FormControl<SignType>('comercial', { nonNullable: true, validators: [Validators.required] }),
        reflPrice: new FormControl<number>(0, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
        qty: new FormControl<number>(1, { nonNullable: true, validators: [Validators.required, Validators.min(1), Validators.max(50)] }),
    });

    error = signal<string | null>(null);

    readonly signTypes: { value: SignType; label: string }[] = [
        { value: 'comercial', label: 'Reflectivo Comercial' },
        { value: 'ingenieria', label: 'Reflectivo Grado Ingeniería' },
        { value: 'vinilo', label: 'Vinilo Común' },
    ];

    addSign(): void {
        this.form.markAllAsTouched();
        if (this.form.invalid) return;

        const { width, height, type, reflPrice, qty } = this.form.getRawValue();
        const err = this.budgetService.addSigns(width, height, qty, type, reflPrice);
        this.error.set(err);
    }

    mod(field: 'width' | 'height' | 'qty', delta: number) {
        const val = this.form.get(field)?.value || 0;
        const newVal = +(val + delta).toFixed(2);

        let min = 0.01;
        if (field === 'qty') min = 1;

        if (newVal >= min) {
            this.form.get(field)?.setValue(newVal);
        }
    }
}
