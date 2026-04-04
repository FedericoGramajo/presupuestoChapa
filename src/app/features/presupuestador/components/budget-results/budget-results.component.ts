import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { BudgetService } from '../../../../core/services/budget.service';

@Component({
    selector: 'app-budget-results',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CurrencyPipe, DecimalPipe, MatIconModule],
    templateUrl: './budget-results.component.html',
    styleUrl: './budget-results.component.scss',
})
export class BudgetResultsComponent {
    readonly budgetService = inject(BudgetService);
}
