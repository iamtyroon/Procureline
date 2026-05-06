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
        move: {
            drag: true,
            scrollbars: true,
            wheel: false,
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
            wheel: false,
        },
    };
}
exports.buildDepartmentUserBlocklyInjectionOptions = buildDepartmentUserBlocklyInjectionOptions;
