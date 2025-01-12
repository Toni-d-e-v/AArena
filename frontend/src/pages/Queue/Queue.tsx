import { FC, useEffect, useMemo, useState } from "react";
import "./styles.scss";
import { TableUI } from "components/Table";
import { TableColumnsType } from "components/Table/types";
import AvatarIcon from "../../assets/images/avatar.png";
import ProgressIcon from "../../assets/svg/progress.svg";
import {
  useAccount,
  useAlert,
  useApi,
  useReadWasmState,
} from "@gear-js/react-hooks";
import { getProgramMetadata } from "@gear-js/api";
import { ARENA_ID, METADATA } from "pages/StartFight/constants";

import { useUnit } from "effector-react";
import { useNavigate } from "react-router-dom";
import { logsStore } from "model/logs";
import { isEmpty } from "lodash";
import { UnsubscribePromise } from "@polkadot/api/types";
import { battle } from "model/battleLogs";
import arenaMetaWasm from "../../assets/arena_state.meta.wasm";

export type QueueProps = {};

const inProgressColumns: TableColumnsType[] = [
  {
    field: "id",
    headerName: "Player ID",
    width: 220,
    position: "center",
  },
  {
    field: "NB",
    headerName: "Number of battles",
    width: 144,
    position: "center",
  },
  {
    field: "level",
    headerName: "Level",
    width: 172,
    position: "center",
  },
];

const getRows = (
  players: Array<{
    id: string;
    attributes: {
      strength: string;
      agility: string;
      vitality: string;
      stamina: string;
    };
    name: string;
  }>
) => {
  return players.map((player) => ({
    id: (
      <div className="row_player">
        <img src={AvatarIcon} />
        <div>
          <p className="row_name">{player.name}</p>
        </div>
      </div>
    ),
    NB: "0",
    level: <span className="row_lvl">1LVL</span>,
  }));
};

export const useWasmMetadata = (source: RequestInfo | URL) => {
  const alert = useAlert();
  const [data, setData] = useState<Buffer>();

  useEffect(() => {
    if (source) {
      fetch(source)
        .then((response) => response.arrayBuffer())
        .then((array) => Buffer.from(array))
        .then((buffer) => setData(buffer))
        .catch(({ message }: Error) => alert.error(`Fetch error: ${message}`));
    }
  }, [source]);

  return { buffer: data };
};

export const Queue: FC<QueueProps> = ({}) => {
  const [updateUsersReadyForBattle, setBattleLog] = useUnit([
    logsStore.updateUsersReadyForBattle,
    battle.setBattleLog,
  ]);

  const [timer, setTimer] = useState(0);
  const navigate = useNavigate();
  const meta = useMemo(() => getProgramMetadata(METADATA), []);
  const players = JSON.parse(localStorage.getItem("players"));
  const inProgressRows = useMemo(() => {
    if (!players || isEmpty(Object.values(players))) {
      return [];
    }
    return getRows(Object.values(players));
  }, [players]);

  useEffect(() => {
    // reset();
    // resetBattleIds();
  }, []);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setTimer((prev) => prev + 1);
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  const { api } = useApi();

  useEffect(() => {
    let unsub: UnsubscribePromise | undefined;
    if (api?.gearEvents) {
      unsub = api.gearEvents.subscribeToGearEvent(
        "UserMessageSent",
        ({
          data: {
            //@ts-ignore
            message,
          },
        }) => {
          if (JSON.parse(message.toString()).source === ARENA_ID) {
            const result = meta
              //@ts-ignore
              .createType(meta.types.handle.output, message.payload)
              //@ts-ignore
              .toJSON();

            console.log("result", result);
            //@ts-ignore
            if (result?.arenaLog) {
              //@ts-ignore
              setBattleLog(result?.arenaLog);
              const allBattleLog =
                JSON.parse(localStorage.getItem("allBattleLog")) ?? [];
              localStorage.setItem(
                "battleLog",
                //@ts-ignore
                JSON.stringify(result?.arenaLog)
              );

              localStorage.setItem(
                "allBattleLog",
                //@ts-ignore
                JSON.stringify(allBattleLog.concat(result?.arenaLog ?? []))
              );

              navigate("/battle");
            }

            if (
              !isEmpty(
                //@ts-ignore
                result?.registeredPlayers
              )
            ) {
              console.log(
                "result?.registeredPlayers",
                //@ts-ignore
                result?.registeredPlayers
              );

              const usersOnQueue = [
                //@ts-ignore
                ...(result?.registeredPlayers || []),
              ].reduce((acc, cur) => {
                return {
                  ...acc,
                  [`${cur.id}`]: cur,
                };
              }, {});
              localStorage.setItem(
                "usersOnQueue",
                JSON.stringify(usersOnQueue)
              );
              localStorage.setItem(
                "players",
                //@ts-ignore
                JSON.stringify(result?.registeredPlayers)
              );
              updateUsersReadyForBattle(usersOnQueue);
            }
          }
        }
      );
    }

    return () => {
      unsub?.then((res) => console.log("res", res()));
    };
  }, [api, meta, navigate, setBattleLog, updateUsersReadyForBattle]);

  return (
    <div className="queue">
      <div className="modal_queue">
        <div className="modal_loader">
          <p className="modal_tille">Tournament participants</p>
          <img className={"modal_progress"} src={ProgressIcon} />
          <p className="modal_info">Waiting players</p>
          <p className="modal_badge">{`${Math.floor(timer / 60)
            .toString()
            .padStart(2, "0")}:${(timer - Math.floor(timer / 60) * 60)
            .toString()
            .padStart(2, "0")}`}</p>
        </div>
        <div className="modal_table">
          <TableUI rows={inProgressRows} columns={inProgressColumns} />
        </div>
      </div>
    </div>
  );
};
