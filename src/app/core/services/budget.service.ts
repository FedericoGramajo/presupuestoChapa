import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { SIGN_COLORS, Sign, SignType } from '../models/sign.model';
import { Sheet } from '../models/sheet.model';
import { BudgetResult, EMPTY_BUDGET, SignBreakdown } from '../models/budget-result.model';
import { StorageService } from './storage.service';

@Injectable({ providedIn: 'root' })
export class BudgetService {
    private readonly storage = inject(StorageService);

    readonly sheet = signal<Sheet>({ width: 2.20, height: 1.20, price: 0 });
    readonly signs = signal<Sign[]>([]);
    readonly selectedId = signal<number | null>(null);
    readonly manualWasteShape = signal<{ w: number, h: number } | null>(null);

    readonly budget = computed<BudgetResult>(() => this.#calculate());

    #nextId = 1;

    constructor() {
        const saved = this.storage.load();
        if (saved) {
            this.sheet.set(saved.sheet);
            this.signs.set(saved.signs);
            this.#nextId = saved.nextId ?? this.#calcNextId(saved.signs);
        }

        // Persistir automáticamente ante cualquier cambio
        effect(() => {
            this.storage.save({
                sheet: this.sheet(),
                signs: this.signs(),
                nextId: this.#nextId,
            });
        });
    }

    // ── Chapa ────────────────────────────────────────────────────────
    updateSheet(patch: Partial<Sheet>): void {
        this.sheet.update(s => ({ ...s, ...patch }));
    }

    // ── Carteles ─────────────────────────────────────────────────────
    /** Agrega `qty` carteles. Retorna un mensaje de error o null si fue exitoso. */
    addSigns(
        width: number, height: number, qty: number,
        type: SignType, reflPrice: number,
    ): string | null {
        const sheet = this.sheet();
        if (width > sheet.width || height > sheet.height) {
            return `El cartel (${width}×${height} m) supera las dimensiones de la chapa (${sheet.width}×${sheet.height} m).`;
        }

        const newSigns: Sign[] = [];
        for (let i = 0; i < qty; i++) {
            const pos = this.#findFreeSpot(width, height, [...this.signs(), ...newSigns]);
            newSigns.push({
                id: this.#nextId++,
                width, height, type, reflPrice,
                x: pos.x,
                y: pos.y,
                color: SIGN_COLORS[(this.#nextId - 2) % SIGN_COLORS.length],
            });
        }

        this.signs.update(s => [...s, ...newSigns]);
        this.selectedId.set(newSigns[newSigns.length - 1].id);
        return null;
    }

    removeSign(id: number): void {
        this.signs.update(s => s.filter(sg => sg.id !== id));
        if (this.selectedId() === id) {
            const remaining = this.signs();
            this.selectedId.set(remaining.length ? remaining[0].id : null);
        }
    }

    moveSign(id: number, x: number, y: number): void {
        this.signs.update(s =>
            s.map(sg => sg.id === id ? { ...sg, x, y } : sg),
        );
    }

    selectSign(id: number): void {
        this.selectedId.set(id);
    }

    clearAll(): void {
        this.signs.set([]);
        this.selectedId.set(null);
        this.storage.clear();
    }

    // ── Privados ─────────────────────────────────────────────────────
    #findFreeSpot(w: number, h: number, existing: Sign[]): { x: number; y: number } {
        const sheet = this.sheet();
        const step = 0.05;
        for (let gy = 0; gy + h <= sheet.height + 0.001; gy = +(gy + step).toFixed(2)) {
            for (let gx = 0; gx + w <= sheet.width + 0.001; gx = +(gx + step).toFixed(2)) {
                if (!this.#overlapsAny(gx, gy, w, h, existing)) return { x: gx, y: gy };
            }
        }
        return { x: 0, y: 0 };
    }

    #overlapsAny(x: number, y: number, w: number, h: number, signs: Sign[]): boolean {
        return signs.some(
            sg => !(x + w <= sg.x || x >= sg.x + sg.width || y + h <= sg.y || y >= sg.y + sg.height),
        );
    }

    #calculate(): BudgetResult {
        const sheet = this.sheet();
        const signs = this.signs();
        if (!signs.length) return EMPTY_BUDGET;

        const sheetArea = sheet.width * sheet.height;
        const calcRes = this.#calcSheets(sheet, signs);
        const sheetsNeeded = calcRes.sheets;
        const chargedShape = calcRes.shape;
        const sheetCost = sheetsNeeded * sheet.price;
        // Precio por m² de chapa (para referencia y cálculo proporcional)
        const sheetCostPerM2 = sheetArea > 0 ? sheet.price / sheetArea : 0;

        // Por cada cartel: su área, costo de reflectivo y su porción de chapa
        const breakdown: SignBreakdown[] = signs.map(sg => {
            const area = +(sg.width * sg.height).toFixed(4);
            const materialCost = area * sg.reflPrice;
            const sheetPortionCost = area * sheetCostPerM2;
            return { sign: sg, area, materialCost, sheetPortionCost };
        });

        const materialCost = breakdown.reduce((acc, b) => acc + b.materialCost, 0);
        const totalSignArea = signs.reduce((acc, sg) => acc + sg.width * sg.height, 0);
        const totalSheetArea = sheetsNeeded * sheetArea;

        // Desperdicio: área de chapa que no se usa → cobrada al cliente
        const wasteArea = totalSheetArea - totalSignArea;
        const wasteCost = wasteArea * sheetCostPerM2;
        const wastePct = totalSheetArea > 0 ? (wasteArea / totalSheetArea) * 100 : 0;

        // Total = chapas + reflectivo (el desperdicio está dentro del costo de chapas)
        const total = sheetCost + materialCost;

        return { total, materialCost, sheetCost, sheetsNeeded, wastePct, wasteCost, sheetCostPerM2, breakdown, chargedShape };
    }

    /** 
     * Bin-packing greedy (row-based) para estimar las fracciones de chapa cobrables.
     * Retorna la suma de chapas enteras (si hay >1) más la fracción de la última chapa.
     * Fracciones estandar: 1/4 (0.25), 1/2 (0.50), o entera (1.0).
     */
    #calcSheets(sheet: Sheet, signs: Sign[]): { sheets: number, shape: { w: number, h: number } } {
        if (!signs.length) return { sheets: 0, shape: { w: 0, h: 0 } };

        let sheets = 1, curX = 0, curY = 0, rowH = 0;
        let maxX = 0, maxY = 0;

        for (const sg of signs) {
            if (curX + sg.width > sheet.width) {
                curX = 0;
                curY += rowH;
                rowH = 0;
            }
            if (curY + sg.height > sheet.height) {
                sheets++;
                curX = 0;
                curY = 0;
                rowH = 0;
                maxX = 0;
                maxY = 0;
            }

            // Actualizar bounding box de la chapa actual (última usada)
            maxX = Math.max(maxX, curX + sg.width);
            maxY = Math.max(maxY, curY + sg.height);

            rowH = Math.max(rowH, sg.height);
            curX += sg.width;
        }

        // Evaluar la fracción de la última chapa
        let fraction = 1.0;
        let shape = { w: sheet.width, h: sheet.height };
        maxY = Math.max(maxY, curY + rowH);

        const mWaste = this.manualWasteShape();
        if (mWaste) {
            shape = mWaste;
            fraction = (mWaste.w * mWaste.h) / (sheet.width * sheet.height);
            return { sheets: (sheets > 1 ? sheets - 1 : 0) + fraction, shape };
        }

        const w2 = sheet.width / 2;
        const h2 = sheet.height / 2;
        const tol = 0.005; // Margen de flotantes

        // Si el contenedor máximo entra en un cuadrante (1/4 de chapa)
        if (maxX <= w2 + tol && maxY <= h2 + tol) {
            fraction = 0.25;
            shape = { w: w2, h: h2 };
        }
        // Si entra en media chapa (ej: 2.2x0.6 ó 1.1x1.2)
        else if (maxX <= w2 + tol || maxY <= h2 + tol) {
            fraction = 0.5;
            if (maxX <= w2 + tol) shape = { w: w2, h: sheet.height };
            else shape = { w: sheet.width, h: h2 };
        }

        return { sheets: (sheets - 1) + fraction, shape }; // chapas previas + fracción de la última
    }

    setWasteOverride(w: number, h: number): void {
        this.manualWasteShape.set({ w, h });
    }

    clearWasteOverride(): void {
        this.manualWasteShape.set(null);
    }

    checkCollision(ignoreId: number, x: number, y: number, w: number, h: number): boolean {
        const tol = 0.001; // micro margen
        return this.signs().some(s =>
            s.id !== ignoreId &&
            x + tol < s.x + s.width && x + w - tol > s.x &&
            y + tol < s.y + s.height && y + h - tol > s.y
        );
    }

    #calcNextId(signs: Sign[]): number {
        return signs.length ? Math.max(...signs.map((s: Sign) => s.id)) + 1 : 1;
    }
}
