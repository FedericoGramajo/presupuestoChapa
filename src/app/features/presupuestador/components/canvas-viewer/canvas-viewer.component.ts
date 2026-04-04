import {
    AfterViewInit, ChangeDetectionStrategy, Component, ElementRef,
    HostListener, inject, OnDestroy, ViewChild, effect,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { BudgetService } from '../../../../core/services/budget.service';
import { Sign } from '../../../../core/models/sign.model';
import { Sheet } from '../../../../core/models/sheet.model';

@Component({
    selector: 'app-canvas-viewer',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MatIconModule],
    templateUrl: './canvas-viewer.component.html',
    styleUrl: './canvas-viewer.component.scss',
})
export class CanvasViewerComponent implements AfterViewInit, OnDestroy {
    @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;
    @ViewChild('wrapper') wrapperRef!: ElementRef<HTMLDivElement>;

    readonly budgetService = inject(BudgetService);

    private ctx!: CanvasRenderingContext2D;
    private initialized = false;
    private zoom = 1;
    private panX = 0;
    private panY = 0;

    // Drag
    private dragging = false;
    private dragSignId: number | null = null;
    private dragOffX = 0;
    private dragOffY = 0;

    // Resizing Waste
    private resizingWaste = false;
    private wasteOriginX = 0;
    private wasteOriginY = 0;

    // Group Dragging (Waste Box)
    private draggingWasteBox = false;
    private isHoveringWasteBody = false;
    private groupStartPositions: { id: number, x: number, y: number }[] = [];

    // Hover state para cambiar cursor
    private isHoveringWasteHandle = false;

    // Panning (Camera)
    private panning = false;
    private panStartX = 0;
    private panStartY = 0;
    private panStartPanX = 0;
    private panStartPanY = 0;

    private resizeObserver!: ResizeObserver;

    constructor() {
        // Effect reactivo a cambios de signals → re-render
        effect(() => {
            this.budgetService.sheet();
            this.budgetService.signs();
            this.budgetService.selectedId();
            this.budgetService.budget(); // Escuchar cambios en la fraccion cobrada
            if (this.initialized) this.render();
        });
    }

    ngAfterViewInit(): void {
        const canvas = this.canvasRef.nativeElement;
        this.ctx = canvas.getContext('2d')!;

        this.resizeObserver = new ResizeObserver(() => {
            this.resizeCanvas();
        });
        this.resizeObserver.observe(this.wrapperRef.nativeElement);

        this.resizeCanvas();
        this.initialized = true;
        this.render();
    }

    ngOnDestroy(): void {
        this.resizeObserver?.disconnect();
    }

    // ── Canvas resize ────────────────────────────────────────────────
    private resizeCanvas(): void {
        const wrapper = this.wrapperRef.nativeElement;
        const canvas = this.canvasRef.nativeElement;
        canvas.width = wrapper.clientWidth;
        canvas.height = wrapper.clientHeight;
        this.fitSheet();
        if (this.initialized) {
            this.render();
        }
    }

    private fitSheet(): void {
        const pad = 48;
        const sheet = this.budgetService.sheet();
        const canvas = this.canvasRef.nativeElement;
        const scaleX = (canvas.width - pad * 2) / sheet.width;
        const scaleY = (canvas.height - pad * 2) / sheet.height;
        this.zoom = Math.min(scaleX, scaleY);
        this.panX = (canvas.width - sheet.width * this.zoom) / 2;
        this.panY = (canvas.height - sheet.height * this.zoom) / 2;
    }

    // ── Coordinate transforms ────────────────────────────────────────
    private toWorld(sx: number, sy: number): { x: number; y: number } {
        return { x: (sx - this.panX) / this.zoom, y: (sy - this.panY) / this.zoom };
    }

    // ── Render ───────────────────────────────────────────────────────
    private render(): void {
        if (!this.ctx) return;
        const canvas = this.canvasRef.nativeElement;
        const sheet = this.budgetService.sheet();
        const signs = this.budgetService.signs();
        const selId = this.budgetService.selectedId();
        const ctx = this.ctx;

        // Actualizar el cursor del canvas interactivamente
        if (this.resizingWaste || this.isHoveringWasteHandle) {
            canvas.style.cursor = 'se-resize';
        } else if (this.dragging || this.draggingWasteBox || this.panning) {
            canvas.style.cursor = 'grabbing';
        } else if (this.isHoveringWasteBody) {
            canvas.style.cursor = 'move';
        } else {
            canvas.style.cursor = 'grab'; // show grab on empty sheet
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const sx = this.panX;
        const sy = this.panY;
        const sw = sheet.width * this.zoom;
        const sh = sheet.height * this.zoom;

        // Sheet background
        ctx.fillStyle = '#1c2a3f';
        ctx.beginPath(); ctx.roundRect(sx, sy, sw, sh, 6); ctx.fill();

        // Grid lines
        for (let x = 0; x <= sheet.width + 0.001; x += 0.1) {
            const px = sx + x * this.zoom;
            // Major grid every 0.5
            const isMajor = Math.abs((x * 10) % 5) < 0.1;
            ctx.strokeStyle = isMajor ? 'rgba(58,90,128,.5)' : 'rgba(58,90,128,.2)';
            ctx.lineWidth = isMajor ? 1 : 0.5;
            ctx.beginPath(); ctx.moveTo(px, sy); ctx.lineTo(px, sy + sh); ctx.stroke();
        }
        for (let y = 0; y <= sheet.height + 0.001; y += 0.1) {
            const py = sy + y * this.zoom;
            const isMajor = Math.abs((y * 10) % 5) < 0.1;
            ctx.strokeStyle = isMajor ? 'rgba(58,90,128,.5)' : 'rgba(58,90,128,.2)';
            ctx.lineWidth = isMajor ? 1 : 0.5;
            ctx.beginPath(); ctx.moveTo(sx, py); ctx.lineTo(sx + sw, py); ctx.stroke();
        }

        // Sheet border
        ctx.strokeStyle = '#3a5a80'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect(sx, sy, sw, sh, 6); ctx.stroke();

        // Rulers (regla top y left)
        ctx.fillStyle = 'rgba(139,148,158,.8)';
        ctx.font = '10px Inter';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        for (let i = 2; i < sheet.width * 10; i += 2) {
            const x = i / 10;
            const px = sx + x * this.zoom;
            ctx.beginPath(); ctx.moveTo(px, sy); ctx.lineTo(px, sy - 4);
            ctx.strokeStyle = 'rgba(139,148,158,.5)'; ctx.lineWidth = 1; ctx.stroke();
            ctx.fillText(`${x.toFixed(1)}`, px, sy - 6);
        }

        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        for (let i = 2; i < sheet.height * 10; i += 2) {
            const y = i / 10;
            const py = sy + y * this.zoom;
            ctx.beginPath(); ctx.moveTo(sx, py); ctx.lineTo(sx - 4, py);
            ctx.strokeStyle = 'rgba(139,148,158,.5)'; ctx.lineWidth = 1; ctx.stroke();
            ctx.fillText(`${y.toFixed(1)}`, sx - 6, py);
        }

        // Waste overlay
        const chargedShape = this.budgetService.budget().chargedShape;
        if (signs.length && chargedShape.w > 0) {
            let minX = Math.min(...signs.map(s => s.x));
            let minY = Math.min(...signs.map(s => s.y));

            const cx = sx + minX * this.zoom;
            const cy = sy + minY * this.zoom;
            const cw = chargedShape.w * this.zoom;
            const ch = chargedShape.h * this.zoom;

            ctx.save();
            ctx.beginPath(); ctx.rect(sx, sy, sw, sh); ctx.clip();
            ctx.beginPath(); ctx.rect(cx, cy, cw, ch); ctx.clip();

            ctx.fillStyle = 'rgba(60,10,10,.4)';
            ctx.fillRect(cx, cy, cw, ch);

            ctx.strokeStyle = 'rgba(248,81,73,.22)';
            ctx.lineWidth = 1;
            for (let i = -canvas.height; i < canvas.width + canvas.height; i += 8) {
                ctx.beginPath();
                ctx.moveTo(i, 0); ctx.lineTo(i + canvas.height, canvas.height); ctx.stroke();
            }

            signs.forEach(sg => {
                const px = sx + sg.x * this.zoom, py = sy + sg.y * this.zoom;
                ctx.clearRect(px, py, sg.width * this.zoom, sg.height * this.zoom);
                ctx.fillStyle = '#1c2a3f';
                ctx.fillRect(px, py, sg.width * this.zoom, sg.height * this.zoom);
            });
            ctx.restore();

            ctx.save();
            ctx.beginPath(); ctx.rect(sx, sy, sw, sh); ctx.clip();
            ctx.strokeStyle = 'rgba(248,81,73,0.85)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]);
            ctx.strokeRect(cx, cy, cw, ch);

            ctx.fillStyle = 'rgba(248,81,73,0.85)';
            ctx.font = '10px Inter';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'bottom';
            ctx.fillText('Desperdicio', cx + cw - 4, cy + ch - 4);

            // Drag handle del desperdicio (esquina inferior derecha)
            const hx = cx + cw;
            const hy = cy + ch;

            ctx.setLineDash([]);
            ctx.fillStyle = this.resizingWaste || this.isHoveringWasteHandle ? '#ff7b72' : '#f85149';
            ctx.beginPath();
            ctx.arc(hx, hy, 7, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.restore();
        }

        // Signs
        signs.forEach(sg => this.drawSign(ctx, sg, sg.id === selId, sheet));

        // Dim labels (Total Dimensions - moved to bottom / right)
        ctx.fillStyle = 'rgba(139,148,158,.6)'; ctx.font = '11px Inter';
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(`${sheet.width} m`, sx + sw / 2, sy + sh + 8);

        ctx.save();
        ctx.translate(sx + sw + 8, sy + sh / 2);
        ctx.rotate(Math.PI / 2);
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText(`${sheet.height} m`, 0, 0);
        ctx.restore();
    }

    private drawSign(ctx: CanvasRenderingContext2D, sg: Sign, selected: boolean, sheet: Sheet): void {
        const px = this.panX + sg.x * this.zoom;
        const py = this.panY + sg.y * this.zoom;
        const pw = sg.width * this.zoom;
        const ph = sg.height * this.zoom;

        if (selected) { ctx.shadowColor = 'rgba(240,165,0,.5)'; ctx.shadowBlur = 14; }
        ctx.fillStyle = selected ? 'rgba(240,165,0,.72)' : (sg.color || 'rgba(88,166,255,.65)');
        ctx.strokeStyle = selected ? '#f0a500' : '#4a7abf';
        ctx.lineWidth = selected ? 2.5 : 1.5;
        ctx.setLineDash([]);
        ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 4);
        ctx.fill(); ctx.stroke();
        ctx.shadowBlur = 0;

        if (pw > 44 && ph > 20) {
            ctx.fillStyle = selected ? '#000' : '#fff';
            ctx.font = `bold ${Math.max(10, Math.min(13, this.zoom * 0.12))}px Inter`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(`${sg.width}×${sg.height}m`, px + pw / 2, py + ph / 2);
        }
    }

    // ── Helpers ──────────────────────────────────────────────────────
    private getWasteHandleHitbox(): { cx: number, cy: number, valid: boolean, ox: number, oy: number } {
        const signs = this.budgetService.signs();
        const chargedShape = this.budgetService.budget().chargedShape;
        if (!signs.length || chargedShape.w === 0) return { cx: 0, cy: 0, valid: false, ox: 0, oy: 0 };

        let minX = Math.min(...signs.map(s => s.x));
        let minY = Math.min(...signs.map(s => s.y));
        const cx = this.panX + (minX + chargedShape.w) * this.zoom;
        const cy = this.panY + (minY + chargedShape.h) * this.zoom;
        return { cx, cy, valid: true, ox: minX, oy: minY };
    }

    // ── Mouse events ─────────────────────────────────────────────────
    onMouseDown(e: MouseEvent): void {
        const { x, y } = this.getCanvasPoint(e);
        const wp = this.toWorld(x, y);

        // 1. Check si presionó el Drag Handle del Desperdicio
        const handle = this.getWasteHandleHitbox();
        if (handle.valid) {
            const dist = Math.hypot(x - handle.cx, y - handle.cy);
            if (dist < 14) {
                this.resizingWaste = true;
                this.wasteOriginX = handle.ox;
                this.wasteOriginY = handle.oy;
                return;
            }
        }

        // 2. Check si presionó un cartel individual
        const sg = this.signAtPoint(wp.x, wp.y);
        if (sg) {
            this.dragging = true;
            this.dragSignId = sg.id;
            this.dragOffX = wp.x - sg.x;
            this.dragOffY = wp.y - sg.y;
            this.budgetService.selectSign(sg.id);
            this.render(); // Actualizar cursor visual
            return;
        }

        // 3. Check si presionó el cuerpo del desperdicio para mover todo el grupo
        const chargedShape = this.budgetService.budget().chargedShape;
        if (handle.valid && chargedShape.w > 0) {
            if (wp.x >= handle.ox && wp.x <= handle.ox + chargedShape.w &&
                wp.y >= handle.oy && wp.y <= handle.oy + chargedShape.h) {

                this.draggingWasteBox = true;
                this.dragOffX = wp.x;
                this.dragOffY = wp.y;
                this.budgetService.selectSign(0); // deseleccionar cartel individual
                const signs = this.budgetService.signs();
                this.groupStartPositions = signs.map(s => ({ id: s.id, x: s.x, y: s.y }));
                this.render();
                return;
            }
        }

        // 4. Click visual fuera de todo -> Paneo libre
        this.budgetService.selectSign(0);
        this.panning = true;
        this.panStartX = e.clientX;
        this.panStartY = e.clientY;
        this.panStartPanX = this.panX;
        this.panStartPanY = this.panY;
        this.render();
    }

    @HostListener('window:mousemove', ['$event'])
    onMouseMove(e: MouseEvent): void {
        // Paneo de cámara priorizado (background puro)
        if (this.panning) {
            this.panX = this.panStartPanX + (e.clientX - this.panStartX);
            this.panY = this.panStartPanY + (e.clientY - this.panStartY);
            this.render();
            return;
        }

        const { x, y } = this.getCanvasPoint(e);
        const wp = this.toWorld(x, y);
        const sheet = this.budgetService.sheet();

        // Si redimensionamos el desperdicio
        if (this.resizingWaste) {
            let nw = wp.x - this.wasteOriginX;
            let nh = wp.y - this.wasteOriginY;
            // Limitar dimensiones al tamaño de la chapa
            nw = Math.max(0.1, Math.min(sheet.width, nw));
            nh = Math.max(0.1, Math.min(sheet.height, nh));

            // Snap a grid local de 0.05 para que sea prolijo (opcional pero ayuda)
            nw = Math.round(nw * 20) / 20;
            nh = Math.round(nh * 20) / 20;

            this.budgetService.setWasteOverride(nw, nh);
            return; // el effect() hace trigger a render()
        }

        // Update hover state for visual feedback
        const handle = this.getWasteHandleHitbox();
        let hoveringHandle = false;
        let hoveringBody = false;
        if (handle.valid) {
            const dist = Math.hypot(x - handle.cx, y - handle.cy);
            hoveringHandle = dist < 14;

            const chargedShape = this.budgetService.budget().chargedShape;
            if (!hoveringHandle && wp.x >= handle.ox && wp.x <= handle.ox + chargedShape.w &&
                wp.y >= handle.oy && wp.y <= handle.oy + chargedShape.h) {
                const sgHover = this.signAtPoint(wp.x, wp.y);
                if (!sgHover) hoveringBody = true;
            }
        }

        if (this.isHoveringWasteHandle !== hoveringHandle || this.isHoveringWasteBody !== hoveringBody) {
            this.isHoveringWasteHandle = hoveringHandle;
            this.isHoveringWasteBody = hoveringBody;
            if (!this.dragging && !this.draggingWasteBox) this.render();
        }

        // Si arrastramos toda la caja de desperdicio (movimiento en bloque)
        if (this.draggingWasteBox) {
            const dx = wp.x - this.dragOffX;
            const dy = wp.y - this.dragOffY;

            let minX = Math.min(...this.groupStartPositions.map(s => s.x));
            let minY = Math.min(...this.groupStartPositions.map(s => s.y));
            let maxX = Math.max(...this.groupStartPositions.map(s => s.x + this.budgetService.signs().find(sg => sg.id === s.id)!.width));
            let maxY = Math.max(...this.groupStartPositions.map(s => s.y + this.budgetService.signs().find(sg => sg.id === s.id)!.height));

            const chargedShape = this.budgetService.budget().chargedShape;
            maxX = Math.max(maxX, minX + chargedShape.w);
            maxY = Math.max(maxY, minY + chargedShape.h);

            let allowedDx = dx;
            let allowedDy = dy;
            if (minX + dx < 0) allowedDx = -minX;
            if (maxX + dx > sheet.width) allowedDx = sheet.width - maxX;
            if (minY + dy < 0) allowedDy = -minY;
            if (maxY + dy > sheet.height) allowedDy = sheet.height - maxY;

            this.groupStartPositions.forEach(sgPos => {
                this.budgetService.moveSign(sgPos.id, sgPos.x + allowedDx, sgPos.y + allowedDy);
            });
            return;
        }

        // Si arrastramos un cartel individual
        if (!this.dragging || this.dragSignId === null) return;

        const sg = this.budgetService.signs().find(s => s.id === this.dragSignId);
        if (!sg) return;

        const nx = Math.max(0, Math.min(sheet.width - sg.width, wp.x - this.dragOffX));
        const ny = Math.max(0, Math.min(sheet.height - sg.height, wp.y - this.dragOffY));

        const oldX = sg.x;
        const oldY = sg.y;

        const currentlyColliding = this.budgetService.checkCollision(sg.id, oldX, oldY, sg.width, sg.height);

        if (currentlyColliding) {
            // Drop-in escape mode: allow move if we are already stuck
            this.budgetService.moveSign(this.dragSignId, nx, ny);
        } else {
            // AABB Sliding response
            if (!this.budgetService.checkCollision(sg.id, nx, ny, sg.width, sg.height)) {
                this.budgetService.moveSign(this.dragSignId, nx, ny);
            } else if (!this.budgetService.checkCollision(sg.id, nx, oldY, sg.width, sg.height)) {
                this.budgetService.moveSign(this.dragSignId, nx, oldY);
            } else if (!this.budgetService.checkCollision(sg.id, oldX, ny, sg.width, sg.height)) {
                this.budgetService.moveSign(this.dragSignId, oldX, ny);
            }
        }
    }

    @HostListener('window:mouseup')
    onMouseUp(): void {
        if (this.dragging || this.resizingWaste || this.draggingWasteBox || this.panning) {
            this.dragging = false;
            this.resizingWaste = false;
            this.draggingWasteBox = false;
            this.panning = false;
            this.dragSignId = null;
            this.render(); // Actualizar cursor
        }
    }

    onWheel(e: WheelEvent): void {
        e.preventDefault();
        const { x, y } = this.getCanvasPoint(e);
        const wp = this.toWorld(x, y);
        const factor = e.deltaY < 0 ? 1.1 : 0.9;
        this.zoom = Math.max(80, Math.min(2000, this.zoom * factor));
        this.panX = x - wp.x * this.zoom;
        this.panY = y - wp.y * this.zoom;
        this.render();
    }

    private getCanvasPoint(e: MouseEvent | WheelEvent): { x: number; y: number } {
        const doc = document.documentElement;
        const body = document.body;
        const scrollTop = window.pageYOffset || doc.scrollTop || body.scrollTop || 0;
        const scrollLeft = window.pageXOffset || doc.scrollLeft || body.scrollLeft || 0;

        // El HostListener global captura el evento fuera del canvas, pero getBindingClientRect solo es local
        const target = e.target as HTMLElement;
        if (target === this.canvasRef.nativeElement) {
            return { x: e.offsetX, y: e.offsetY };
        }

        // Coordenadas absolutas si el evento ocurre fuera del canvas (arrastrando rápido)
        const rect = this.canvasRef.nativeElement.getBoundingClientRect();
        return {
            x: (e.pageX || e.clientX + scrollLeft) - (rect.left + scrollLeft),
            y: (e.pageY || e.clientY + scrollTop) - (rect.top + scrollTop)
        };
    }

    private signAtPoint(wx: number, wy: number): Sign | null {
        const signs = this.budgetService.signs();
        for (let i = signs.length - 1; i >= 0; i--) {
            const sg = signs[i];
            if (wx >= sg.x && wx <= sg.x + sg.width && wy >= sg.y && wy <= sg.y + sg.height) {
                return sg;
            }
        }
        return null;
    }
}
