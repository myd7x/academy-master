export default function Reports() {
  return (
    <>
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 px-8 py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Reports</h2>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 p-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <div className="text-center">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              Reports & Analytics
            </h3>
            <p className="text-gray-600">
              Reports and analytics functionality will be implemented here.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
