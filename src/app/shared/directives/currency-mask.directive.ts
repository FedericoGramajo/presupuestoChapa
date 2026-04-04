import { Directive, HostListener, OnInit, inject } from '@angular/core';
import { NgControl } from '@angular/forms';

@Directive({
    selector: '[appCurrencyMask]',
    standalone: true
})
export class CurrencyMaskDirective implements OnInit {
    private control = inject(NgControl);

    ngOnInit() {
        // Interceptar la escritura inicial del modelo a la vista para formatear
        const originalWrite = this.control.valueAccessor!.writeValue.bind(this.control.valueAccessor);
        this.control.valueAccessor!.writeValue = (value: any) => {
            if (value != null && value !== '') {
                const num = Number(value);
                if (!isNaN(num)) {
                    const formatted = new Intl.NumberFormat('es-AR').format(num);
                    originalWrite(formatted);
                    return;
                }
            }
            originalWrite(value);
        };
    }

    @HostListener('input', ['$event.target'])
    onInput(input: HTMLInputElement) {
        const start = input.selectionStart || 0;
        const oldLength = input.value.length;

        // Remover todo lo que no sea dígito
        const digits = input.value.replace(/\D/g, '');
        if (!digits) {
            this.control.control?.setValue(null);
            input.value = '';
            return;
        }

        const num = parseInt(digits, 10);
        // Formatear num a formato español (AR) -> ej: 100.000
        const formatted = new Intl.NumberFormat('es-AR').format(num);

        input.value = formatted;

        // Actualizar control subyacente silenciosamente para que sea numero puro
        this.control.control?.setValue(num, { emitEvent: false });

        // Restaurar posición del cursor más aproximada posible
        const newLength = input.value.length;
        let newStart = start + (newLength - oldLength);
        if (newStart < 0) newStart = 0;

        // SetTimeout para asegurarse de que Angular no sobrescriba la posición
        setTimeout(() => input.setSelectionRange(newStart, newStart), 0);
    }
}
