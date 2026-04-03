"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDepartmentUserBlocklyInjectionOptions = void 0;
function buildDepartmentUserBlocklyInjectionOptions(args) {
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
exports.buildDepartmentUserBlocklyInjectionOptions = buildDepartmentUserBlocklyInjectionOptions;
