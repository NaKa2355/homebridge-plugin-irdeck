import { AimServiceClient } from 'irdeck-proto/gen/js/aim/api/v1/aim_service_grpc_web_pb';
import { GetButtonsRequest, GetIrDataRequest } from 'irdeck-proto/gen/js/aim/api/v1/aim_service_pb';
import { Remote } from 'irdeck-proto/gen/js/aim/api/v1/remote_pb';
import { Button } from 'irdeck-proto/gen/js/aim/api/v1/button_pb';

import { PiRemServiceClient } from 'irdeck-proto/gen/js/pirem/api/v1/pirem_service_grpc_web_pb';
import { SendIrRequest } from 'irdeck-proto/gen/js/pirem/api/v1/pirem_service_pb';
import { IrData } from 'irdeck-proto/gen/js/pirem/api/v1/irdata_pb';

import { Any } from 'google-protobuf/google/protobuf/any_pb';
import { Empty } from 'google-protobuf/google/protobuf/empty_pb';

export class IrdeckApi {
  private readonly aimClient: AimServiceClient;
  private readonly piremClient: PiRemServiceClient;

  constructor(aimUrl: string, piremUrl: string) {
    this.aimClient = new AimServiceClient(aimUrl);
    this.piremClient = new PiRemServiceClient(piremUrl);
  }

  public notifyUpdate = (
    onAdd?: (remote: Remote) => void,
    onDelete?: (remoteId: string) => void,
    onUpdate?: (remote: Remote) => void,
  ) => {
    const stream = this.aimClient.notifyUpdate(new Empty());
    stream.on('data', (res) => {
      if (res.hasAdd()) {
        const remote = res.getAdd()?.getRemote();
        if (remote) {
          onAdd?.(remote);
        }
      }
      if (res.hasDelete()) {
        const remoteId = res.getDelete()?.getRemoteId();
        if(remoteId) {
          onDelete?.(remoteId);
        }
      }
      if (res.hasUpdate()) {
        const remote = res.getUpdate()?.getRemote();
        if (remote) {
          onUpdate?.(remote);
        }
      }
    });
  };

  public getRemotes = () => {
    const promise = new Promise<Remote[]>((resolve, reject) => {
      this.aimClient.getRemotes(new Any(), {}, (err, res) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(res.getRemotesList());
        return;
      });
    });
    return promise;
  };

  public getButtons = (remoteId: string) => {
    const promise = new Promise<Button[]>((resolve, reject) => {
      const req = new GetButtonsRequest();
      req.setRemoteId(remoteId);

      this.aimClient.getButtons(req, {}, (err, res) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(res.getButtonsList());
        return;
      });
    });
    return promise;
  };

  public getIrData = (remoteId: string, buttonId: string) => {
    const promise = new Promise<IrData>((resolve, reject) => {
      const req = new GetIrDataRequest();
      req.setRemoteId(remoteId);
      req.setButtonId(buttonId);

      this.aimClient.getIrData(req, {}, (err, res) => {
        if (err) {
          reject(err);
          return;
        }

        const irData = res.unpack<IrData>(IrData.deserializeBinary, res.getTypeName());
        if (!irData) {
          reject();
          return;
        }

        resolve(irData);
        return;
      });
    });
    return promise;
  };

  public sendIrData = (deviceId: string, irData: IrData) => {
    const promise = new Promise<void>((resolve, reject) => {
      const req = new SendIrRequest();
      req.setDeviceId(deviceId);
      req.setIrData(irData);

      this.piremClient.sendIr(req, {}, (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
        return;
      });
    });
    return promise;
  };
}