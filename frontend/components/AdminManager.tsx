'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { addresses } from '@/lib/contracts';
import { coreAbi } from '@/lib/abis';
import { isAdmin as checkIsAdmin } from '@/lib/hooks';

export default function AdminManager() {
  const { address } = useAccount();
  const [newAdminAddress, setNewAdminAddress] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentAdmins, setCurrentAdmins] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Check if current user is admin
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (address) {
        const adminStatus = await checkIsAdmin(address);
        setIsAdmin(adminStatus);
      }
    };
    checkAdminStatus();
  }, [address]);

  // Read current admin role holders (SpeculateCore uses AccessControl)
  // We can't easily enumerate, but we can check if the deployer/admin address has the role
  const DEFAULT_ADMIN_ROLE = '0x0000000000000000000000000000000000000000000000000000000000000000';
  
  const { data: deployerHasRole } = useReadContract({
    address: addresses.core,
    abi: coreAbi,
    functionName: 'hasRole',
    args: [DEFAULT_ADMIN_ROLE as `0x${string}`, addresses.admin],
  });

  // Write contract for adding admin
  const { 
    data: addHash, 
    writeContract: addAdmin, 
    isPending: isAdding,
    error: addError
  } = useWriteContract();
  
  const { isLoading: isConfirmingAdd, isSuccess: isAddSuccess } = useWaitForTransactionReceipt({ 
    hash: addHash 
  });

  // Write contract for removing admin
  const { 
    data: removeHash, 
    writeContract: removeAdmin, 
    isPending: isRemoving,
    error: removeError
  } = useWriteContract();
  
  const { isLoading: isConfirmingRemove, isSuccess: isRemoveSuccess } = useWaitForTransactionReceipt({ 
    hash: removeHash 
  });

  // Load current admins (for SpeculateCore, we can only check specific addresses)
  useEffect(() => {
    const loadAdmins = async () => {
      setLoading(true);
      try {
        const adminsList: string[] = [];
        
        // Add deployer/admin if they have the role
        if (deployerHasRole) {
          adminsList.push(addresses.admin.toLowerCase());
        }
        
        // Note: With AccessControl, we can't easily enumerate all admins
        // Users can check specific addresses via hasRole(DEFAULT_ADMIN_ROLE, address)
        setCurrentAdmins(adminsList);
      } catch (error) {
        console.error('Error loading admins:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadAdmins();
  }, [deployerHasRole, isAddSuccess, isRemoveSuccess]);

  // Handle add admin success
  useEffect(() => {
    if (isAddSuccess) {
      alert('Admin added successfully!');
      setNewAdminAddress('');
      setLoading(true);
      // Reload admins
      setTimeout(() => {
        setLoading(false);
      }, 2000);
    }
  }, [isAddSuccess]);

  // Handle remove admin success
  useEffect(() => {
    if (isRemoveSuccess) {
      alert('Admin removed successfully!');
      setLoading(true);
      // Reload admins
      setTimeout(() => {
        setLoading(false);
      }, 2000);
    }
  }, [isRemoveSuccess]);

  const handleAddAdmin = async () => {
    if (!newAdminAddress || !newAdminAddress.startsWith('0x') || newAdminAddress.length !== 42) {
      alert('Please enter a valid Ethereum address (0x...)');
      return;
    }

    try {
      // Grant DEFAULT_ADMIN_ROLE using AccessControl
      await addAdmin({
        address: addresses.core,
        abi: coreAbi,
        functionName: 'grantRole',
        args: [DEFAULT_ADMIN_ROLE as `0x${string}`, newAdminAddress as `0x${string}`],
      });
    } catch (error: any) {
      console.error('Error adding admin:', error);
      alert(`Failed to add admin: ${error?.message || 'Unknown error'}`);
    }
  };

  const handleRemoveAdmin = async (adminToRemove: string) => {
    if (!confirm(`Are you sure you want to remove admin ${adminToRemove}?`)) {
      return;
    }

    try {
      // Revoke DEFAULT_ADMIN_ROLE using AccessControl
      await removeAdmin({
        address: addresses.core,
        abi: coreAbi,
        functionName: 'revokeRole',
        args: [DEFAULT_ADMIN_ROLE as `0x${string}`, adminToRemove as `0x${string}`],
      });
    } catch (error: any) {
      console.error('Error removing admin:', error);
      alert(`Failed to remove admin: ${error?.message || 'Unknown error'}`);
    }
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Admin Management</h3>
      
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Current Admins</h4>
        {loading ? (
          <p className="text-sm text-gray-500">Loading admins...</p>
        ) : (
          <div className="space-y-2">
            {currentAdmins.length > 0 ? (
              currentAdmins.map((admin, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-blue-50 rounded-md border border-blue-200">
                  <div>
                    <p className="text-sm font-medium text-blue-900">
                      {admin}
                    </p>
                    <p className="text-xs text-blue-600">Has DEFAULT_ADMIN_ROLE</p>
                  </div>
                  <span className="px-2 py-1 text-xs font-semibold text-blue-700 bg-blue-200 rounded">
                    Admin
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">No admins found</p>
            )}
            <p className="text-xs text-gray-500 mt-2">
              Note: With AccessControl, we can't enumerate all admins. Use hasRole(DEFAULT_ADMIN_ROLE, address) to check specific addresses.
            </p>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Add New Admin
          </label>
          <input
            type="text"
            value={newAdminAddress}
            onChange={(e) => setNewAdminAddress(e.target.value)}
            placeholder="0x..."
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-gray-500">
            Enter the Ethereum address to grant admin privileges
          </p>
        </div>

        <button
          onClick={handleAddAdmin}
          disabled={isAdding || isConfirmingAdd || !newAdminAddress}
          className="w-full rounded-md bg-green-600 px-4 py-3 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {(isAdding || isConfirmingAdd) ? 'Adding Admin...' : 'Add Admin'}
        </button>

        {(isAdding || isConfirmingAdd) && (
          <div className="p-3 bg-yellow-50 rounded-md border border-yellow-200">
            <p className="text-sm text-yellow-800">
              Transaction pending... Please wait for confirmation.
            </p>
          </div>
        )}

        {addError && (
          <div className="p-3 bg-red-50 rounded-md border border-red-200">
            <p className="text-sm text-red-800">
              <strong>Error:</strong> {addError.message}
            </p>
          </div>
        )}

        {removeError && (
          <div className="p-3 bg-red-50 rounded-md border border-red-200">
            <p className="text-sm text-red-800">
              <strong>Error:</strong> {removeError.message}
            </p>
          </div>
        )}
      </div>

      <div className="mt-6 pt-6 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Check Admin Status</h4>
        <p className="text-xs text-gray-600 mb-2">
          To check if an address is an admin, use the contract function:
        </p>
        <code className="block p-2 bg-gray-100 rounded text-xs text-gray-800 break-all">
          hasRole(DEFAULT_ADMIN_ROLE, address) returns (bool)
        </code>
        <p className="text-xs text-gray-500 mt-2">
          DEFAULT_ADMIN_ROLE = 0x0000000000000000000000000000000000000000000000000000000000000000
        </p>
      </div>
    </div>
  );
}

