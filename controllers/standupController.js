import Member from "../models/Member.js";
import Task from "../models/Task.js";
import Standup from "../models/standup.js";
import StandupMessage from "../models/standupMessage.js";
import { parseStandupMessage } from "../services/parserService.js";

// POST /api/standups
// Manual stand-up paste from the dashboard.
//
// NOTE (fix): this previously wrote to an ad-hoc `ManualStandup` model that
// lived only in this file, completely separate from the real `standups`
// collection used by the Slack pipeline. That meant manually-pasted standups
// never showed up next to Slack-sourced ones anywhere in the app. This now
// uses the same Standup + StandupMessage models as the Slack pipeline, with
// source: 'Manual', exactly as the schema's `source` enum intends.
export const processStandup = async (req, res) => {
    try {
        const { rawText, memberId } = req.body;

        if (!rawText || rawText.trim() === "") {
            return res.status(400).json({ error: "rawText is required." });
        }

        // A manual paste isn't tied to one speaker the way a Slack message is,
        // but the schema requires submittedBy. Fall back to a generic
        // "dashboard" submitter reference if none was supplied.
        let submitter = null;
        if (memberId) {
            submitter = await Member.findById(memberId);
        }

        const standupRecord = await Standup.create({
            submittedBy: submitter ? submitter._id : null,
            source: "Manual",
            parsingStatus: "Processing",
            message: rawText,
            parsed: false,
        });

        // Step 2: Parser runs
        const parsedTasks = await parseStandupMessage(rawText);

        if (!parsedTasks || parsedTasks.length === 0) {
            await Standup.findByIdAndUpdate(standupRecord._id, { parsingStatus: "Failed" });
            return res.status(400).json({ error: "Invalid stand-up: No tasks could be extracted." });
        }

        const createdTasks = [];

        // Step 3: Process tasks and create members dynamically
        const seen = new Set();

        const uniqueTasks = parsedTasks.filter((task) => {
            const key = `${(task.owner || "").trim().toLowerCase()}-${(task.taskName || "").trim().toLowerCase()}`;

            if (seen.has(key)) {
                return false;
            }

            seen.add(key);
            return true;
        });

        // Process only unique tasks
        for (const pt of uniqueTasks) {

            let memberName = pt.owner;

            if (!memberName || memberName.trim() === "") {
                memberName = "Unknown";
            }

            let member = await Member.findOne({
                name: new RegExp(`^${memberName}$`, "i")
            });

            if (!member) {
                member = await Member.create({
                    name: memberName,
                    email: `${memberName.toLowerCase().replace(/\s+/g, ".")}@placeholder.slack`,
                    role: "Developer",
                    isActive: true,
                });
            }

            // Avoid creating duplicate StandupMessage
            const existingMessage = await StandupMessage.findOne({
                standupId: standupRecord._id,
                memberId: member._id,
                rawMessage: rawText,
            });

            if (!existingMessage) {
                await StandupMessage.create({
                    standupId: standupRecord._id,
                    memberId: member._id,
                    rawMessage: rawText,
                    parsed: true,
                });
            }

            if (pt.taskName && pt.taskName.trim() !== "") {

                const task = await Task.findOneAndUpdate(
                    {
                        standupId: standupRecord._id,
                        memberId: member._id,
                        title: pt.taskName.trim(),
                    },
                    {
                        $set: {
                            description: pt.blockerDescription || null,
                            status:
                                pt.status === "COMPLETED"
                                    ? "COMPLETED"
                                    : pt.status === "BLOCKED"
                                        ? "BLOCKED"
                                        : "PROCESSING",
                            priority: pt.priority || "Medium",
                            workflowStage: pt.workflowStage || "DEVELOPMENT",
                        },
                    },
                    {
                        upsert: true,
                        new: true,
                        setDefaultsOnInsert: true,
                    }
                );

                createdTasks.push(task);
            }
        }

        await Standup.findByIdAndUpdate(standupRecord._id, { parsingStatus: "Completed", parsed: true });

        res.status(201).json({
            message: "Standup processed successfully",
            standupId: standupRecord._id,
            tasksAdded: createdTasks.length,
            tasks: createdTasks,
        });

    } catch (error) {
        console.error("Parsing Error:", error);
        res.status(500).json({ error: "Failed to process stand-up." });
    }
};

// GET /api/standups?limit=20
// Lists recent stand-ups (both Slack-sourced and manually pasted) for the
// Stand-up Summary page.
export const getStandups = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const standups = await Standup.find()
            .populate('submittedBy', 'name role')
            .sort({ createdAt: -1 })
            .limit(limit);
        res.status(200).json(standups);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// GET /api/standups/:id
// A single stand-up plus the tasks that were extracted from it, so the UI
// can show "Extracted Tasks" next to the "Original Message" panel.
export const getStandupById = async (req, res) => {
    try {
        const standup = await Standup.findById(req.params.id).populate('submittedBy', 'name role');
        if (!standup) return res.status(404).json({ error: 'Standup not found.' });

        const tasks = await Task.find({ standupId: standup._id }).populate('memberId', 'name role');

        res.status(200).json({ standup, tasks });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
