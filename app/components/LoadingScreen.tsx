import React, { FC } from 'react';
import { Spinner } from '@nextui-org/react';

interface LoadingScreenProps {
  message: string;
}

const LoadingScreen: FC<LoadingScreenProps> = ({ message }) => {
  return (
    <div className='flex flex-col items-center justify-center h-screen'>
      <Spinner size='lg' />
      <p className='text-lg mt-4'>{message}</p>
    </div>
  );
};

export default LoadingScreen;
