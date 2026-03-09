"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNestServiceRequest = void 0;
const procureline_service_auth_1 = require("./procureline-service-auth");
function createNestServiceRequest(args) {
    return {
        init: {
            body: args.body === undefined ? undefined : JSON.stringify(args.body),
            headers: (0, procureline_service_auth_1.buildProcurelineServiceHeaders)(args.token),
            method: "POST",
        },
        url: `${(0, procureline_service_auth_1.resolveNestjsUrl)()}${args.path}`,
    };
}
exports.createNestServiceRequest = createNestServiceRequest;
