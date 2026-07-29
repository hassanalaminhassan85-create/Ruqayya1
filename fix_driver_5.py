with open("src/features/DriverDashboard.tsx") as f:
    lines = f.read().splitlines()

new_lines = []
for i, line in enumerate(lines):
    if 1535 <= i <= 1578:
        pass # drop these
    else:
        new_lines.append(line)

replacement = """                        {selectedInstallment.paymentDetails ? (
                          <>
                            <div className="flex justify-between py-2 border-b border-border-main/40">
                              <span className="text-text-muted font-bold">{t.installments.paid}:</span>
                              <span className="font-extrabold font-mono text-emerald-600">₦{selectedInstallment.paymentDetails.amount.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-border-main/40">
                              <span className="text-text-muted font-bold">{t.installments.receiptNo}:</span>
                              <span className="font-extrabold font-mono text-brand-gold">{selectedInstallment.paymentDetails.receipt_number}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-border-main/40">
                              <span className="text-text-muted font-bold">{t.installments.receivedBy}:</span>
                              <span className="font-semibold text-text-main">{selectedInstallment.paymentDetails.approved_by || 'Awaiting Review'}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-border-main/40">
                              <span className="text-text-muted font-bold">{t.installments.datePaid}:</span>
                              <span className="font-semibold font-mono text-text-main">{selectedInstallment.paymentDetails.date}</span>
                            </div>
                            {selectedInstallment.paymentDetails.remarks && (
                              <div className="p-3 bg-bg-base border border-border-main/50 rounded-lg text-[11px] text-text-muted mt-2 font-mono">
                                <strong>Remarks:</strong> {selectedInstallment.paymentDetails.remarks}
                              </div>
                            )}
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setSelectedReceipt(selectedInstallment.paymentDetails);
                                setSelectedInstallment(null);
                              }}
                              className="w-full mt-4 font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <Printer className="h-4 w-4" />
                              {t.history.print}
                            </Button>
                          </>
                        ) : ("""

new_lines.insert(1535, replacement)

with open("src/features/DriverDashboard.tsx", "w") as f:
    f.write("\n".join(new_lines))
