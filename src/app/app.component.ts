import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PresupuestadorComponent } from './features/presupuestador/presupuestador.component';

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PresupuestadorComponent],
  template: `
    <header class="app-header">
      <div class="app-header__logo">VialSa</div>
      <div>
        <h1 class="app-header__title">Presupuestador de Carteles</h1>
        <p class="app-header__subtitle">Calculadora de material, desperdicio y costo — Vialsa</p>
      </div>
    </header>
    <app-presupuestador />
  `,
  styleUrl: './app.component.scss',
})
export class AppComponent { }
