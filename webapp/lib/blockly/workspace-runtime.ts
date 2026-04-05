export interface DepartmentUserBlocklyInjectionOptions {
    grid: {
        colour: string;
        length: number;
        snap: boolean;
        spacing: number;
    };
    move: {
        drag: boolean;
        scrollbars: boolean;
        wheel: boolean;
    };
    readOnly: boolean;
    toolbox: Record<string, unknown>;
    trashcan: boolean;
    zoom: {
        controls: boolean;
        maxScale: number;
        minScale: number;
        pinch: boolean;
        scaleSpeed: number;
        startScale: number;
        wheel: boolean;
    };
}

export function buildDepartmentUserBlocklyInjectionOptions(args: {
    editorMode: "edit" | "view";
    toolboxDefinition: Record<string, unknown>;
}): DepartmentUserBlocklyInjectionOptions {
    return {
        grid: {
            colour: "#d4d4d8",
            length: 3,
            snap: true,
            spacing: 20,
        },
        move: {
            drag: true,
            scrollbars: true,
            wheel: true,
        },
        readOnly: args.editorMode === "view",
        toolbox: args.toolboxDefinition,
        trashcan: args.editorMode === "edit",
        zoom: {
            controls: true,
            maxScale: 1.8,
            minScale: 0.4,
            pinch: true,
            scaleSpeed: 1.1,
            startScale: 0.9,
            wheel: true,
        },
    };
}
