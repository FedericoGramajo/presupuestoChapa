import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { debounceTime } from 'rxjs';
import { BudgetService } from '../../../../core/services/budget.service';
import { CurrencyMaskDirective } from '../../../../shared/directives/currency-mask.directive';

@Component({
    selector: 'app-sheet-form',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatIconModule, CurrencyMaskDirective],
    templateUrl: './sheet-form.component.html',
    styleUrl: './sheet-form.component.scss',
})
export class SheetFormComponent implements OnInit {
    private readonly budgetService = inject(BudgetService);
    expanded = signal(true);

    form = new FormGroup({
        width: new FormControl<number>(2.20, { nonNullable: true, validators: [Validators.required, Validators.min(0.1)] }),
        height: new FormControl<number>(1.20, { nonNullable: true, validators: [Validators.required, Validators.min(0.1)] }),
        price: new FormControl<number>(0, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
    });

    ngOnInit(): void {
        const sheet = this.budgetService.sheet();
        this.form.patchValue({ width: sheet.width, height: sheet.height, price: sheet.price }, { emitEvent: false });

        // RxJS para flujo asíncrono con debounce
        this.form.valueChanges.pipe(debounceTime(300)).subscribe(() => {
            if (this.form.valid) {
                const { width, height, price } = this.form.getRawValue();
                this.budgetService.updateSheet({ width, height, price });
            }
        });
    }

    mod(field: 'width' | 'height', delta: number) {
        const val = this.form.get(field)?.value || 0;
        const newVal = +(val + delta).toFixed(2);
        if (newVal >= 0.1) {
            this.form.get(field)?.setValue(newVal);
        }
    }
}
