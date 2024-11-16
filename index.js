import { ethers } from 'ethers';
import path from 'path';
import fs from 'fs-extra';
import storageArtifact from 'mechain-precompile/storage/IStorage.json' assert { type: 'json' };
import { Storage } from '@zkmelabs/storage-sdk-js';
import { lookup } from 'mime-types';
import { ReedSolomon } from '@bnb-chain/reed-solomon';

export const main = async () => {
  try {
    const now = '1731735336005' || new Date().getTime();

    // PLEASE UPDATE YOU DATA BELOW
    const privateKey = '3554368e93208a8fe6c67b94d18a9aeaa1ae006b2815b753b08620a788128232';
    const rpc = 'http://testnet-rpc.mechain.tech:80';
    const storageAddress = '0x0000000000000000000000000000000000002001';
    const primarySpAddress = '0x1Ba86D47193Ad486d9839c7d4ee561c0C33ca184';
    const bucketName = 'mechain' + now;
    const objectName = 'zkme' + now;
    const filePath = path.join('./test.txt');

    const fileBuffer = fs.readFileSync(filePath);
    const { abi } = storageArtifact;
    const provider = new ethers.JsonRpcProvider(rpc);
    const wallet = new ethers.Wallet(privateKey, provider);
    const storage = new ethers.Contract(storageAddress, abi, wallet);

    let find = false;
    console.log({ bucketName, objectName });

    // query bucket
    {
      find = false;
      try {
        const [bucketInfo, extraInfo] = await storage.headBucket(bucketName);
        console.log('bucket:', bucketInfo.toObject(true));
        console.log('extraInfo:', extraInfo.toObject(true));
        find = true;
      } catch (error) {
        find = false;
      }
    }

    // create bucket
    if (!find) {
      const visibility = 2;
      const paymentAddress = wallet.address;
      const approval = {
        expiredHeight: 0,
        globalVirtualGroupFamilyId: 1,
        sig: '0x00',
      };
      const chargedReadQuota = '100000000000000';
      const tx = await storage.createBucket(bucketName, visibility, paymentAddress, primarySpAddress, approval, chargedReadQuota);
      const receipt = await tx.wait();
      console.log('create bucket success, receipt: ', receipt);
    }

    // query object
    {
      find = false;
      const pageRequest = {
        key: '0x00',
        offset: 0,
        limit: 100,
        countTotal: false,
        reverse: false,
      };

      const [objects, _] = await storage.listObjects(pageRequest, bucketName);
      for (const object of objects) {
        if (object.bucketName === bucketName && object.objectName === objectName) {
          console.log('object', object.toObject(true));
          find = true;
          break;
        }
      }

      // have some error to query object
      // const [objectInfo, globalVirtualGroup] = await storage.headObject(bucketName, objectName);
      // console.log('objectInfo:', objectInfo.toObject(true));
      // console.log('globalVirtualGroup:', globalVirtualGroup.toObject(true));
    }

    // create object
    if (!find) {
      const extname = path.extname(filePath);
      const rs = new ReedSolomon(1, 1);
      // input params
      const payloadSize = fileBuffer.length;
      const visibility = 1;
      const contentType = lookup(extname);
      const approval = {
        expiredHeight: 0,
        globalVirtualGroupFamilyId: 1,
        sig: '0x00',
      };
      const expectChecksums = rs.encode(Uint8Array.from(fileBuffer));
      const redundancyType = 0;
      const storage = new ethers.Contract(storageAddress, abi, wallet);
      const tx = await storage.createObject(bucketName, objectName, payloadSize, visibility, contentType, approval, expectChecksums, redundancyType);
      const receipt = await tx.wait();
      console.log('create object success, receipt: ', receipt);
    }

    // upload file
    {
      const storage = new Storage(rpc, 5151);
      await storage.uploadObject(
        {
          bucketName,
          objectName,
          body: fileBuffer,
        },
        {
          type: 'ECDSA',
          privateKey,
        }
      );

      const data = await storage.downloadFile(
        {
          bucketName,
          objectName,
        },
        {
          type: 'ECDSA',
          privateKey,
        }
      );

      console.log(data);
    }
  } catch (error) {
    console.log('error', error);
  }
};

main();
