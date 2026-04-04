import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SheetFormComponent } from './components/sheet-form/sheet-form.component';
import { SignFormComponent } from './components/sign-form/sign-form.component';
import { SignListComponent } from './components/sign-list/sign-list.component';
import { CanvasViewerComponent } from './components/canvas-viewer/canvas-viewer.component';
import { BudgetResultsComponent } from './components/budget-results/budget-results.component';

@Component({
    selector: 'app-presupuestador',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        SheetFormComponent,
        SignFormComponent,
        SignListComponent,
        CanvasViewerComponent,
        BudgetResultsComponent,
    ],
    templateUrl: './presupuestador.component.html',
    styleUrl: './presupuestador.component.scss',
})
export class PresupuestadorComponent { }
