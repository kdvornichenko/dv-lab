import React, { FC } from 'react';

interface AuthButtonProps {
  onClick: () => void;
  isAuthorized: boolean;
}

const AuthButton: FC<AuthButtonProps> = ({ onClick, isAuthorized }) => {
  return (
    <div className='flex flex-col items-center justify-center h-screen'>
      <button
        onClick={onClick}
        className='mb-4 px-4 py-2 bg-blue-500 text-white rounded'
      >
        {isAuthorized ? 'Logout' : 'Authorize'}
      </button>
    </div>
  );
};

export default AuthButton;
