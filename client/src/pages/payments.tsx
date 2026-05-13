import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import PaymentOverview from "@/components/payments/payment-overview";
import PaymentRecords from "@/components/payments/payment-records";
import AddPaymentModal from "@/components/modals/add-payment-modal";

export default function Payments() {
  const [showAddPayment, setShowAddPayment] = useState(false);

  return (
    <>
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 px-8 py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Payments</h2>
          <div className="flex space-x-3">
            <Button 
              onClick={() => setShowAddPayment(true)}
              className="bg-academy-blue hover:bg-academy-blue-light text-white"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Payment
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <PaymentOverview />
          <PaymentRecords />
        </div>
      </main>

      <AddPaymentModal
        open={showAddPayment}
        onOpenChange={setShowAddPayment}
      />
    </>
  );
}
