export interface DepartmentUserBlocklyInjectionOptions {
    grid: {
        colour: string;
        length: number;
        snap: boolean;
        spacing: number;
    };
    readOnly: boolean;
    scrollbars: boolean;
    toolbox?: Record<string, unknown>;
    trashcan: boolean;
    zoom: {
        controls: boolean;
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
        readOnly: args.editorMode === "view",
        scrollbars: true,
        toolbox: args.editorMode === "edit" ? args.toolboxDefinition : undefined,
        trashcan: args.editorMode === "edit",
        zoom: {
            controls: true,
            startScale: 0.9,
            wheel: true,
        },
    };
}
