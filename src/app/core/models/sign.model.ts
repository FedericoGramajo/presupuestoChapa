export type SignType = 'comercial' | 'ingenieria' | 'vinilo';

export interface Sign {
    id: number;
    width: number;
    height: number;
    type: SignType;
    reflPrice: number;
    x: number;
    y: number;
    color: string;
}

export const SIGN_TYPE_LABELS: Record<SignType, string> = {
    comercial: 'Reflectivo Comercial',
    ingenieria: 'Reflectivo Grado Ingeniería',
    vinilo: 'Vinilo Común',
};

export const SIGN_COLORS: string[] = [
    'rgba(240,165,0,.72)',
    'rgba(88,166,255,.72)',
    'rgba(63,185,80,.72)',
    'rgba(210,100,230,.72)',
    'rgba(255,120,80,.72)',
    'rgba(80,220,200,.72)',
];
