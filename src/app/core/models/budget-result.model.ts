import { Sign } from './sign.model';

export interface SignBreakdown {
    sign: Sign;
    area: number;          // m² del cartel
    materialCost: number;  // área × precio reflectivo
    sheetPortionCost: number; // proporción de chapa que ocupa el cartel
}

export interface BudgetResult {
    total: number;
    materialCost: number;   // total reflectivo/vinilo
    sheetCost: number;      // n_chapas × precio_chapa
    sheetsNeeded: number;
    wastePct: number;       // % de desperdicio
    wasteCost: number;      // costo del área desperdiciada en la chapa
    sheetCostPerM2: number; // precio por m² de chapa (para referencia)
    breakdown: SignBreakdown[];
    chargedShape: { w: number; h: number }; // forma del área cobrada
}

export const EMPTY_BUDGET: BudgetResult = {
    total: 0,
    materialCost: 0,
    sheetCost: 0,
    sheetsNeeded: 0,
    wastePct: 0,
    wasteCost: 0,
    sheetCostPerM2: 0,
    breakdown: [],
    chargedShape: { w: 0, h: 0 },
};
