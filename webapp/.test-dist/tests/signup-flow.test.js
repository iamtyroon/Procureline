"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runSignupFlowTests = void 0;
const strict_1 = __importDefault(require("node:assert/strict"));
const signup_flow_1 = require("../lib/auth/signup-flow");
function runSignupFlowTests() {
    const completedTests = [];
    strict_1.default.deepEqual((0, signup_flow_1.createPendingSignupState)({
        email: "admin@university.ac.ke",
        organizationName: "University of Nairobi",
        selectedTier: "starter",
    }), {
        email: "admin@university.ac.ke",
        organizationName: "University of Nairobi",
        selectedTier: "starter",
    });
    completedTests.push("signup state persistence keeps the pending verification email, organization name, and selected tier together for recovery");
    strict_1.default.deepEqual((0, signup_flow_1.restoreSignupFlowState)({
        isAuthenticated: false,
        pendingTenantSetupRetry: false,
        pendingVerificationEmail: "admin@university.ac.ke",
    }), {
        email: "admin@university.ac.ke",
        mode: "signup",
        step: "verify",
    });
    strict_1.default.deepEqual((0, signup_flow_1.restoreSignupFlowState)({
        isAuthenticated: true,
        pendingTenantSetupRetry: true,
        pendingVerificationEmail: "admin@university.ac.ke",
    }), {
        email: "",
        mode: "tenant-retry",
        step: "signup",
    });
    strict_1.default.deepEqual((0, signup_flow_1.restoreSignupFlowState)({
        isAuthenticated: false,
        pendingTenantSetupRetry: true,
        pendingVerificationEmail: "admin@university.ac.ke",
    }), {
        email: "admin@university.ac.ke",
        mode: "signup",
        step: "verify",
    });
    strict_1.default.deepEqual((0, signup_flow_1.restoreSignupFlowState)({
        isAuthenticated: false,
        pendingTenantSetupRetry: false,
        pendingVerificationEmail: null,
    }), {
        email: "",
        mode: "signup",
        step: "signup",
    });
    completedTests.push("signup flow restoration returns users to verification after refresh and only enters tenant-retry mode for authenticated recovery");
    return completedTests;
}
exports.runSignupFlowTests = runSignupFlowTests;
