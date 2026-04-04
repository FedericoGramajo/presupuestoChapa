import { Injectable } from '@angular/core';
import { Sheet } from '../models/sheet.model';
import { Sign } from '../models/sign.model';

const LS_KEY = 'vialsa_presupuestador_v2';

export interface StorableState {
    sheet: Sheet;
    signs: Sign[];
    nextId: number;
}

@Injectable({ providedIn: 'root' })
export class StorageService {
    save(state: StorableState): void {
        try {
            localStorage.setItem(LS_KEY, JSON.stringify(state));
        } catch {
            // ignorar errores de cuota
        }
    }

    load(): StorableState | null {
        try {
            const raw = localStorage.getItem(LS_KEY);
            return raw ? (JSON.parse(raw) as StorableState) : null;
        } catch {
            return null;
        }
    }

    clear(): void {
        localStorage.removeItem(LS_KEY);
    }
}
