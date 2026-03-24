export var TransactionType;
(function (TransactionType) {
    TransactionType["CREDIT"] = "CREDIT";
    TransactionType["DEBIT"] = "DEBIT";
    TransactionType["REFUND"] = "REFUND";
    TransactionType["WITHDRAWAL"] = "WITHDRAWAL";
    TransactionType["TRIP_PAYMENT"] = "TRIP_PAYMENT";
    TransactionType["ADMIN_CREDIT"] = "ADMIN_CREDIT";
})(TransactionType || (TransactionType = {}));
export var TransactionStatus;
(function (TransactionStatus) {
    TransactionStatus["PENDING"] = "PENDING";
    TransactionStatus["COMPLETED"] = "COMPLETED";
    TransactionStatus["FAILED"] = "FAILED";
    TransactionStatus["CANCELLED"] = "CANCELLED";
})(TransactionStatus || (TransactionStatus = {}));
export var WithdrawalStatus;
(function (WithdrawalStatus) {
    WithdrawalStatus["PENDING"] = "PENDING";
    WithdrawalStatus["APPROVED"] = "APPROVED";
    WithdrawalStatus["REJECTED"] = "REJECTED";
    WithdrawalStatus["PROCESSING"] = "PROCESSING";
    WithdrawalStatus["COMPLETED"] = "COMPLETED";
})(WithdrawalStatus || (WithdrawalStatus = {}));
//# sourceMappingURL=wallet.types.js.map