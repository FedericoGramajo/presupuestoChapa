import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { BudgetService } from '../../../../core/services/budget.service';
import { SIGN_TYPE_LABELS } from '../../../../core/models/sign.model';

@Component({
    selector: 'app-sign-list',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MatIconModule, MatButtonModule, MatTooltipModule, CurrencyPipe, DecimalPipe],
    templateUrl: './sign-list.component.html',
    styleUrl: './sign-list.component.scss',
})
export class SignListComponent {
    readonly budgetService = inject(BudgetService);
    readonly typeLabels = SIGN_TYPE_LABELS;
    expanded = signal(true);

    trackById(_: number, sign: { id: number }): number {
        return sign.id;
    }
}
